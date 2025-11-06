# Dynamic API Generator
A Internal Developer app to publish API's from Web UI

## Prerequisites
- <b> [NodeJS](https://nodejs.org/) </b>  18+ and [Git](https://git-scm.com/) </b>
- SQLite (bundled) or another DB supported by Prisma

## How to get it working

- In terminal `git clone https://github.com/Awanish-26/DynAPI.git`
- cd in DynAPI and open one more terminal
    1. ```
        cd server
        npm i 
        npm run dev
        ```
    2. ```
        cd client
        npm i
        npm run dev  OR
        npm start
        ```
- follow the client terminal link to open the app in browser
- Register with role and password
- Login with registered role and password

## Create and Publish a New Model
- Click on <b> Create Model </b> button
- Give a Name to Model
- Add Field according to need and add permmsions for the model (all,read,update,delete)
- Click on <b> Publish Model </b> button.
- Wait for few 4 - 5 sec so that endpoints for your app become live.
- Back to main page you will see you model.
- Its API's for the created model are live and can be used accordingly 
    - `POST   /api/<modelName>`
    - `GET    /api/<modelName>`
    - `GET    /api/<modelName>/:id`
    - `PUT    /api/<modelName>/:id`
    - `DELETE /api/<modelName>/:id`

