import {asyncHandler} from "../util/asyncHandler.js";
import {ApiError} from "../util/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../util/cloudinary.js"
import { ApiResponce } from "../util/ApiResponce.js";
import jwt from "jsonwebtoken"

const generateAccessTokenAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false })
        return {accessToken,refreshToken}


    } catch (error) {
        throw new ApiError(500,'Something went wrong while generating access and refresh token')
    }
}

const registerUser = asyncHandler( async (req,res,) => {
    /* steps for registering user 
        1. get user detail from frontend
        2. validation - not empty
        3. check if user already exists: from username,email
        4. check for images,avatar(bcz avatar img is compulsory in user models)
        5. upload images to cloudinary
        6. create user object(for create entry in db)
        7. remove password and refresh token field from responce
        8. check for user creation(if created return res) 
    */


        // STEP 1
        const {fullName,email,username,password}= req.body
        


        // if(fullName === ""){
        //     throw new ApiError(400,"Full Name is required")
        // }else if(email === ""){
        //     throw new ApiError(400,"email is required")
        // }else if(username === ""){
        //     throw new ApiError(400,"username is required")
        // }else if(password === ""){
        //     throw new ApiError(400,"password is required")
        // }

        // pro method to check empty input from clint || STEP 2

        if (
            [fullName,email,username,password].some((field) => field?.trim() === "")
        ) {
            throw new ApiError(400,"All fields are required")
        }


        // if user already existed checking || STEP 3
        const existedUser = await User.findOne({
            $or: [{username},{email}]
        })
        if(existedUser){
            throw new ApiError(409,"User with email or username already existed")
        }

        // STEP 4
        const avatarLocalPath = req.files?.avatar[0]?.path;
        // let avatarLocalPath;
        // if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        //     avatarLocalPath = req.files.avatar[0].path
        // }
        
        // const coverImageLocalPath = req.files?.coverImage[0]?.path;
        let coverImageLocalPath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImageLocalPath = req.files.coverImage[0].path
        }
        

        if (!avatarLocalPath) {
            throw new ApiError(400,"Avatar file is required")
        }
        // STEP 5
        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
        

        if (!avatar) {
            throw new ApiError(400,"Avatar file is required");
        }

        const user = await User.create({
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username:username.toLowerCase()
        })

        const createdUser = await User.findById(user._id).select(
            // this field can not be selected when it comes from database
            "-password -refreshToken"
        )
        if(!createdUser){
            throw new ApiError(500,"Error while registering  the user ")
        }

        return res.status(201).json(
            new ApiResponce(200,createdUser,"Registered Successfully")
        )


} )

const loginUser = asyncHandler(async (req,res) => {
    // get data from req.body
    // login either from username or email
    // find the user in db
    // password check{if wrong {message= password is incorrect} if right go to dashboard || homepage}
    // manage access and refresh token 
    // send secure cookie
    // send respons login successfully

    const {email,username,password} = req.body
    if (!username && !email) {
        throw new ApiError(400,'username or email is required ')
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,'user does not exist')
    }

    const isPasswordValid= await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid User Inputs")

    }

    const {accessToken,refreshToken} = await generateAccessTokenAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //  cookies by default can be modified by frontend 
    //  after using httpOnly and secure it can only modified by server 
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponce(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
    )

})
//LOGOUT USER 
    const logoutUser = asyncHandler(async(req,res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken: undefined
                }
            },
            {
                new:true
            }
        )

        
        const options = {
        httpOnly: true,
        secure: true
        }


        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponce(200,{},"User logged out"))


    })


    const refreshAccessToken = asyncHandler(async(req,res)=>{
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken


        if (!incomingRefreshToken) {
            throw new ApiError(401,"Unauthorized request")
        }


        try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.REFRESH_TOKEN_SECRET
            )
    
            const user = await User.findById(decodedToken?._id)
            if(!user){
                throw new ApiError(401,"invalid refresh token")
            }
    
            if (incomingRefreshToken !== user?.refreshToken) {
                throw new ApiError(401,"refresh token is invalid or expired")
            }
            const options = {
                httpOnly: true,
                secure: true
            }
            const {accessToken,newRefreshToken}= await generateAccessTokenAndRefreshTokens(user._id)
            return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",newRefreshToken,options)
            .json(
                new ApiResponce(
                    200,
                    {accessToken : accessToken,refreshToken: newRefreshToken,},
                    "Access token refreshed Successfully"
                )
            )
        } catch (error) {
            throw new ApiError(401,error?.message || "invalid refresh token ")
        }

        
        
    })
    
    const changeCurrentPassword = asyncHandler(async(req,res)=>{
        const {oldPassword,newPassword,confirmPassword} = req.body
        if (newPassword !== confirmPassword) {
            throw new ApiError(400,"new password not matching confirm password")
        }
        const user = await User.findById(req.user?._id)

        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

        if(!isPasswordCorrect){
            throw new ApiError(400,"invalid old password")
        }

        user.password = newPassword
        await user.save({validateBeforeSave: false})

        return res
        .status(200)
        .json(new ApiResponce(200,{},"Password changed Successfully"))

    })

    const getCurrentUser = asyncHandler(async(req,res)=>{
        return res
        .status(200)
        .json(200,req.user,"current user fetch successfully")
    })

    const updateAccountDetails = asyncHandler(async(req,res)=>{
        const {fullName,email} = req.body

        if(!fullName || !email){
            throw new ApiError(400,"all fields needed")
        }
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullName : fullName,
                    email : email
                }
            },
            {new: true}
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponce(200,user,"account details updated successfully"))
    })

    const updateUserCoverImage = asyncHandler(async(req,res)=>{

        const coverImageLocalPath = req.file?.path
        
        if (!coverImageLocalPath) {
            throw new ApiError(400,"coverImage file is missing")
        }
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)

        if (!coverImage.url) {
            throw new ApiError(400,"error while uploading the coverImage could not find the url")
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    coverImage : coverImage.url
                }
            },
            {new:true}
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponce(200,user,"coverImage updated successfully"))

    })

    const updateUserAvatar = asyncHandler(async(req,res)=>{
        const avatarLocalPath = req.file?.path
        
        if (!avatarLocalPath) {
            throw new ApiError(400,"Avatar file is missing")
        }
        const avatar = await uploadOnCloudinary(avatarLocalPath)

        if (!avatar.url) {
            throw new ApiError(400,"error while uploading the avatar could not find the url")
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    avatar : avatar.url
                }
            },
            {new:true}
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponce(200,user,"avatar updated successfully"))

    })

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
}