import { Client } from "pg"
const connectPGDB= async () => {
    const con=new Client({
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "prac",
    database: "postgres"
    })
    con.connect().then(() => {
        console.log("connected");
        
    })
    con.query('select * from student ',(err,res)=>{
        if(!err){
            console.log(res.rows); 
        }else{
            console.log(err.message);
            
        }
        con.end;
    })
}

export { connectPGDB }