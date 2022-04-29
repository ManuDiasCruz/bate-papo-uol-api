import express, { json } from 'express'
import cors from 'cors'
import chalk from 'chalk'
import { MongoClient } from 'mongodb'


const app = express()
app.use(cors())
app.use(json())


let db = null
const mongoClient = new MongoClient('mongodb://localhost:27017') // process.env.MONGO_URI
const promise = mongoClient.connect()
        .then(()=>{
            db = mongoClient.db('api-bate-papo-uol') // process.env.BANCO
            console.log(chalk.blue.bold('Banco de dados conectado com sucesso!'))
        })
        .catch(e => console.log(chalk.red.bold('Problema na conexão com o banco'), e))
