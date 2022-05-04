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

dotenv.config()

// Database connection
let db = null
const mongoClient = new MongoClient(process.env.MONGO_URL) // process.env.MONGO_URI
const promise = mongoClient.connect()
promise.then(()=>{
    db = mongoClient.db(process.env.DATABASE) // process.env.BANCO
    console.log(chalk.blue.bold('Banco de dados conectado com sucesso!'))
})
promise.catch(e => console.log(chalk.red.bold('Problema na conexão com o banco'), e))


// Schemas for database collections
const participant = Joi.object({
    name: Joi.string().alphanum().min(1).required()
})

const message = Joi.object({
    from: Joi.string().required(), 
    to: Joi.string().required(), 
    text: Joi.string().required(), 
    type: Joi.string().valid('message', 'private_message').required(),
    time: Joi.string().required()
})


// Listening
app.listen(process.env.DOOR, () => console.log(chalk.bold.cyan(`Server listening at http://localhost:${process.env.DOOR}`)))


// Requests
app.post('/participants', async (req, res) => {

    const name = req.body

    console.log('Estou no POST/participants', name)

    const validation = participant.validate(name)
    if (validation.error) 
        return res.status(422).send('Error validating participant name!')

    try{
        const dbParticipants = await db.collection('participants')
        const dbMessages = await db.collection('messages')

        const thereIsName = await dbParticipants.findOne({ name: name.name })
        if (thereIsName)
            return res.status(409).send(`There is already a user named ${name}`)

        await dbParticipants.insertOne({ name, lastStatus: Date.now() })
        await dbMessages.insertOne({from: name, 
                                    to: 'Todos', 
                                    text: 'entra na sala...', 
                                    type: 'status',
                                    time: dayjs().format('HH:mm:ss')
        })
        console.log('Msgs: ', dbMessages.find())
        res.status(201).send('User inserted at participants database!')
    }catch (e){
        res.status(500).send(e)
    }finally{
        mongoClient.close()
    }
})

app.get('/participants', async (req, res) => {
    try{
        const dbParticipants = await db.collection('participants')
        const participantsList = await dbParticipants.find().toArray()
        
        console.log('Estou no GET/participants', participantsList)
        
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

    console.log('Estou no POST/messages', user, req.body)

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
        console.log('Estou no try', msg)
        const dbParticipants = await db.collection('participants')
        const dbMessages = await db.collection('messages')

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
        const dbMessages = await db.collection('messages')
        const messagesList = await dbMessages.find().toArray()

        const userMsgs = messagesList.find(msg => {
            return ((msg.type == 'message' || msg.type == 'status') ||
                    (msg.to == user||msg.from == user))
        })

        if (limit)
            res.send(userMsgs.slice(-limit))
            //msgsToSend = userMsgs.splice(userMsgs.length - limit) // 

        console.log('Estou no GET/messages', userMsgs)
        res.send(userMsgs)
    }catch (e){
        res.status(400).send(e)
    }finally{
        mongoClient.close()
    }
})

app.post('/status', async (req, res) => {
    const user = req.headers.user

    try{
        const dbParticipants = await mongoClient.db(process.env.DATABASE).collection('participants')
        
        const thereIsUame = await dbParticipants.findOne({ user })
        if (!thereIsUame)
            return res.status(404).send(`There is not a user named ${user}`)

        await dbParticipants.updateOne(
            { _id: user._id },
            { $set: { lastStatus: Date.now() } }
        )

        res.status(200).send('User inserted at participants database!')
    }catch (e){
        res.status(500).send(e)
    }finally{
        mongoClient.close()
    }
})

const TIME_TO_CHECK = 15 * 1000
setInterval(async() => {
    try{
        const TIME_INATIVE = 10 * 1000
        const currentTime = Date.now()
        let timeDifference = currentTime - TIME_INATIVE

        mongoClient.connect()
        const inactiveParticipants = await db.collection('participants').find({ lastStatus: { $lte: timeDifference } }).toArray()

        if (inactiveParticipants > 0){
            const inativeMessages = inactiveParticipants.map(participant => {
                return {
                  from: participant.name,
                  to: 'Todos',
                  text: 'sai da sala...',
                  type: 'status',
                  time: dayjs().format("HH:mm:ss")
                }
              })
        
              await db.collection("messages").insertMany(inativeMessages)
              await db.collection("participants").deleteMany({ lastStatus: { $lte: TIME_INATIVE } })
        }

        /* const dbMessages = await db.collection('messages')

        let participantsList = dbParticipants.find().toArray()

        participantsList.forEach(async (participant) => {
            
            let timeDifference = currentTime - participant.lastStatus
            if (timeDifference > 10000){
                await dbParticipants.deleteOne({ _id: participant._id });
                await dbMessages.insertOne({ from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss') })
            }
        }) */
    }catch (e){
        console.log('Error removing inative users', e)
    }finally{
        mongoClient.close()
    }
}, 15000)