import express, { json } from 'express'
import cors from 'cors'
import chalk from 'chalk'
import { MongoClient } from 'mongodb'
import Joi from 'joi'
import dotenv from 'dotenv'

const app = express()
app.use(cors())
app.use(json())


// Database connection
let db = null
dotenv.config()
const mongoClient = new MongoClient(process.env.MONGO_URL) // process.env.MONGO_URI
const promise = mongoClient.connect()
        .then(()=>{
            db = mongoClient.db(process.env.DATABASE) // process.env.BANCO
            console.log(chalk.blue.bold('Banco de dados conectado com sucesso!'))
        })
        .catch(e => console.log(chalk.red.bold('Problema na conexão com o banco'), e))


// Schemas for database collections
const participant = Joi.object({
    name: Joi.string().required()
})

const message = Joi.object({
    from: Joi.string().required(), 
    to: Joi.string().required(), 
    text: Joi.string().required(), 
    type: Joi.string().required()
})


// Requests
app.get('/participants', async (req, res) => {
    try{
        await mongoClient.connect()
        const dbParticipants = mongoClient.db(process.env.DATABASE).collection('participants')
        const participantsList = dbParticipants.find().toArray()
        res.send(participantsList)
    }catch (e){
        console.log(e);
        res.status(400).send(e);
    }finally{
    mongoClient.close();
    }
})


app.post('/participants', async (req, res) => {

    const { name } = req.body;

})