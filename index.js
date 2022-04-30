import express, { json } from 'express'
import cors from 'cors'
import chalk from 'chalk'
import { MongoClient } from 'mongodb'
import Joi from 'joi'
import dotenv from 'dotenv'

const app = express()
app.use(cors())
app.use(json())

dotenv.config()

let db = null
const mongoClient = new MongoClient(process.env.MONGO_URI) // process.env.MONGO_URI
const promise = mongoClient.connect()
        .then(()=>{
            db = mongoClient.db(process.env.DATABASE) // process.env.BANCO
            console.log(chalk.blue.bold('Banco de dados conectado com sucesso!'))
        })
        .catch(e => console.log(chalk.red.bold('Problema na conexão com o banco'), e))

const participant = Joi.object({
    name: Joi.string().required()
})

const message = Joi.object({
    from: Joi.string().required(), 
    to: Joi.string().required(), 
    text: Joi.string().required(), 
    type: Joi.string().required()
})
