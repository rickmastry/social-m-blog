const {MongoClient} = require('mongodb')
const dotenv = require('dotenv')
dotenv.config()

const client = new MongoClient(process.env.CONNECTIONSTRING)

async function startConnection(){
    await client.connect()
    module.exports = client
    const app = require('./app')
    app.listen(process.env.PORT)
}

startConnection()