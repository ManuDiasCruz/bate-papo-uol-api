import express, { json } from 'express'
import cors from 'cors'
import chalk from 'chalk'
import { MongoClient } from 'mongodb'
import Joi from 'joi'
import dotenv from 'dotenv'
import dayjs from 'dayjs'

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
    name: Joi.string().alphanum().min(1).required()
})

const message = Joi.object({
    from: Joi.string().required(), 
    to: Joi.string().min(1).required(), 
    text: Joi.string().min(1).required(), 
    type: Joi.string().required(),
    time: Joi.string().required()
})


// Requests
app.post('/participants', async (req, res) => {

    const { name } = req.body

    const validation = participant.validate({ name }, { abortEarly: true })
    if (validation.error) 
        return res.status(422).send('Error validating participant name!')

    try{
        await mongoClient.connect()
        const dbParticipants = mongoClient.db(process.env.DATABASE).collection('participants')
        const dbMessages = mongoClient.db(process.env.DATABASE).collection('messages')

        const thereIsName = await dbParticipants.findOne({ name })
        if (thereIsName)
            return res.status(409).send(`There is already a user named ${name}`)

        await dbParticipants.insertOne({ name, lastStatus: Date.now() })
        await dbMessages.insertOne({from: name, 
                                    to: 'Todos', 
                                    text: 'entra na sala...', 
                                    type: 'status',
                                    time: dayjs().format('HH:mm:ss')
                                })

        res.status(201).send('User inserted at participants database!')
    }catch (e){
        res.status(500).send(e)
    }finally{
        mongoClient.close()
    }

})

app.get('/participants', async (req, res) => {
    try{
        await mongoClient.connect()
        const dbParticipants = mongoClient.db(process.env.DATABASE).collection('participants')
        const participantsList = dbParticipants.find().toArray()
        res.send(participantsList)
    }catch (e){
        res.status(400).send(e)
    }finally{
        mongoClient.close()
    }
})

app.post('/messages', async (req, res) => {

    const { to, text, type } = req.body
    const user = req.headers.user

    const msg = { from: user, 
                  to, 
                  text, 
                  type,
                  time: dayjs().format('HH:mm:ss')
                }
    const validation = message.validate(msg, { abortEarly: true })
    if (validation.error) 
        return res.status(422).send('Error validating message!')

    try{
        await mongoClient.connect()
        const dbParticipants = mongoClient.db(process.env.DATABASE).collection('participants')
        const dbMessages = mongoClient.db(process.env.DATABASE).collection('messages')

        const thereIsParticipant = await dbParticipants.findOne({ name: user })
        if (thereIsParticipant)
            return res.status(422).send(`Participant ${user} not found!`)

        await dbMessages.insertOne(msg)

        res.status(201).send('Message inserted at messages database!')
    }catch (e){
        res.status(500).send(e)
    }finally{
        mongoClient.close()
    }

})

app.get('/messages', async (req, res) => {

    const user = req.headers.user
    const { limit } = req.query

    try{
        await mongoClient.connect()
        const dbMessages = mongoClient.db(process.env.DATABASE).collection('messages')
        const messagesList = dbMessages.find().toArray()

        const userMsgs = messagesList.find(msg => {
            return ((msg.type == 'message' || msg.type == 'status') ||
                    (msg.to == user||msg.from == user))
        })

        let msgsToSend = userMsgs

        if (limit)
            msgsToSend = userMsgs.splice(userMsgs.length - limit)
        
        res.send(userMsgs)
    }catch (e){
        res.status(400).send(e)
    }finally{
        mongoClient.close()
    }
})
