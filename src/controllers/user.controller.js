import { request } from "express";
import {asyncHandler} from "../util/asyncHandler.js";
import {ApiError} from "../util/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../util/cloudinary.js"
import { ApiResponce } from "../util/ApiResponce.js";

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
        console.log("email:",email);
        console.log("password:",password);


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
        const existedUser = User.findOne({
            $or: [{username},{email}]
        })
        if(existedUser){
            throw new ApiError(409,"User with email or username already existed")
        }

        // STEP 4
        const avatarLocalPath = req.files?.avatar[0]?.path;
        const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

export {registerUser}