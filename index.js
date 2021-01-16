//requiring all needed packages 
const express = require("express") //Webserver
const Discord = require("discord.js");//Client import for the discord bot
const { fstat } = require("fs");
const client = new Discord.Client();
const path = require("path");
const bodyParser = require("body-parser");
const iplocate = require("node-iplocate");
const requestIp = require('request-ip');
var multer  = require('multer')
const fs = require("fs");
const { fileURLToPath } = require("url");
var token = "Your_Token" //Login-Token for the Bot
var app = express()

//Webserver Code
app.use(express.static(__dirname + "/public")); //Where are the static html files? 
app.use(bodyParser.urlencoded({ extended: true })); //Encodes the incoming form
app.use(requestIp.mw())

//-----------------------------------------------------------------------------Webserver Area------------------------------------------------------------------------------------------------------------

//Create a ticket
app.post("/new", async function (req, res){
    var subject = req.body.sub
    var desc = req.body.desc
    var ticket_id = Math.round(Math.random() * (2000000000000000 - 1000000000000000 )) + 1000000000000000 ;
    let guild = client.guilds.cache.get("636302212787601408");
    if (!guild.me.hasPermission("MANAGE_CHANNELS", true, true, true)) return res.send("Oops, I can\'t create a new ticket, because I don\'t have the right permissions for that. Please contact the Stuff")
    
    //Creating Channel
    await guild.channels.create(`ticket-${ticket_id}`, {
        type: 'text',
        permissionOverwrites: [
            {
                id: guild.id,
                deny: ['VIEW_CHANNEL'],
            },
            // {
            //     id: "759370067787382804",
            //     allow: ['VIEW_CHANNEL'],
            // },
        ],
    }).then(async function(channel){
        console.log(channel.id)
        channel.send(`
**__New Ticket__**

**${subject}**
${desc}
        `);

        //writing Channel ID to "database"
        var channels = fs.readFileSync(__dirname + "/data/channels.json")
        channels = JSON.parse(channels)
        channels[ticket_id] = {
            channel : channel.id
        }
        fs.writeFileSync(__dirname + "/data/channels.json", JSON.stringify (channels, null, 4), err => {
            if(err) throw err;
          })
          
        //Creating Conversation File
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1) //January is 0!
        var yyyy = today.getFullYear();
        var hh = today.getHours();
        var mm = today.getMinutes();
        
        var date = dd + '.' + mm + '.' + yyyy +" "+ hh+":" +mm;
        var pics = req.body.pics
        var messages = [[1,desc, "You", date]]
        var ip = req.clientIp;
        var country;
        console.log(ip)
        iplocate(ip).then(function(results) {
            country = results.country
        })
        var other = {"topic": subject, "created": date, "country": country, "claimed": "Waiting for Agent"}
        fs.writeFileSync(__dirname +"/data/conversations/"+ticket_id+".json", JSON.stringify(messages,null,4))
        fs.writeFileSync(__dirname +"/data/other/"+ticket_id+".json", JSON.stringify(other,null,4))

    //Moves the Channel in the right category in the discord Server
    let category1 = guild.channels.cache.find(c => c.name.toLowerCase() == "tickets" && c.type == "category")
    channel.setParent(category1.id);

    });
    //redirects the user to the "success"-page
    var send = fs.readFileSync(__dirname+"/success/index.html", "utf8")
 send = await send.replace("#--TICKETID--#", ticket_id)
 send = await send.replace("#--TICKETLINK--#", `href="http://localhost/ticket/`+ticket_id+`"`)
    res.send(send)
})

//The ticket site generator 

app.get("/ticket/*", async function(req, res){
    var ticket_id = req.url.split("/")[2] //get the ID of the Ticket
    //Check if a ticket with this id exists 
   try{
    fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json")
   }catch(error){
      return res.send("There is no ticket with this id")
   }
   var other_stuff = JSON.parse(fs.readFileSync(__dirname+"/data/other/"+ticket_id+".json")) //General Informations about the ticket (e.g. Date of creation, Agent etc )
    var ticketchannels_raw = fs.readFileSync(__dirname + "/data/channels.json")
    ticketchannels = JSON.parse(ticketchannels_raw)
        if(!ticketchannels[ticket_id]) return res.send("Oops, there is no ticket with the ID "+ticket_id+" in my Database")
        var messages_raw = fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json")
    var messages = JSON.parse(messages_raw)
      var l = await messages.reverse();

      //replaces the values in the html file 
  var send = fs.readFileSync(__dirname +"/ticket/nice.html", "utf8")
  send = send.replace("#--TICKETNAME--#", `Ticket-${ticket_id}`)
  send = send.replace("#--TICKETTOPIC--#", `${other_stuff.topic}`)
  send = send.replace("#--Country--#", `${other_stuff.country}`)
  for(i=0; i<2;i++){
  send = send.replace("#--DATE--#", `${other_stuff.created}`)
  }
  send = send.replace("#--MODERATOR--#", `${other_stuff.claimed}`)
  send = send.replace("#--FORMACTION--#", `action="http://localhost/ticket/${ticket_id}"`)
  send = send.replace("#--FORMACTION_DELETE--#", `action="http://localhost/close/${ticket_id}"`)


    var replace = "<hi></hi>";
    l.forEach(element => {
        if(element[4]){
            img_replace = `<img src="http://localhost/uploads/images/${element[4]}">`
            console.log("Element"+element[4])
        }else{
            img_replace = ` ` 
        }
        if(element[2] == "You") replace = replace + `<div id="content">
        <div id="name"><img src="https://i.stack.imgur.com/34AD2.jpg">You</div>
        <div id="date">${element[3]}</div>
        <div id="text">${element[1]}</div>
        <div id="imggs">${img_replace}</div>
    </div>`
        if(element[2] == "Mod") replace = replace + `<div id="content">
        <div id="name"><img src="http://localhost/uploads/images/YourLogo.png">Supporter</div>
        <div id="date">${element[3]}</div>
        <div id="text">${element[1]}</div>
        <div id="imggs">${img_replace}</div>
    </div>`
        console.log(element[1])
      });

      send = send.replace("#--REPLACE--#", replace)
    setTimeout(()=>{
    res.send(send)
},500)
      
})

//closes a ticket
app.post("/close/*", async function(req, res){
    var ticket_id = req.url.split("/")[2]
    var ticketchannels_raw = fs.readFileSync(__dirname + "/data/channels.json")
        ticketchannels = JSON.parse(ticketchannels_raw)
            if(!ticketchannels[ticket_id]) return res.send("Oops, there is no ticket with the ID "+ticket_id+" in my Database")
            var file = JSON.parse(fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json"));
            var messages_raw = fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json")
            var messages = JSON.parse(messages_raw)
            messages.push([file[file.length-1][0]+1, "This ticket will close in 5 seconds", "Mod", "Now"]);
            res.redirect("http://localhost/ticket/"+ticket_id)
            fs.writeFileSync(__dirname +"/data/conversations/"+ticket_id+".json", JSON.stringify (messages, null, 4), err => {
                if(err) throw err;
              })
      setTimeout(()=>{
        delete ticketchannels[ticket_id]
        fs.writeFileSync(__dirname + "/data/channels.json", JSON.stringify (ticketchannels, null, 4), err => {
            if(err) throw err;
          })
          //deletes the files belonging to the ticket
        fs.unlinkSync(__dirname +"/data/conversations/"+ticket_id+".json")
        fs.unlinkSync(__dirname +"/data/other/"+ticket_id+".json")
            return client.channels.cache.find(channel => channel.name === `ticket-${ticket_id}`).delete();
      },6000)  
    
})
//This is for the fileupload
const upload = multer({
    dest: "G:/TicketSupport/public/uploads/images"
 
  });  

  //get the inpput from the tickets
app.post("/ticket/*", upload.array('desc'),async function(req, res){
    var ticket_id = req.url.split("/")[2]
    var messages_raw = fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json")
    var messages = JSON.parse(messages_raw)
    var file = JSON.parse(fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json"));
    var desc = req.body.desc
    var tempPath;
    var name;
    //If there is an image in the input, it will be saved here
    try{
     tempPath = req.files[0].path;
     var targetPath = path.join(__dirname, "./public/uploads/images/"+req.files[0].originalname);
     fs.rename(tempPath, targetPath, err => {
    
    })
    var name = req.files[0].originalname
    }catch(error)
{
    tempPath = 0
    name;
}

//creating a new message entry
    var d = new Date()
    var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var mm = String(today.getMonth() + 1) //January is 0!
var yyyy = today.getFullYear();
var hh = today.getHours();
var mm = today.getMinutes();

var date = dd + '.' + mm + '.' + yyyy +" "+ hh+":" +mm;
    messages.push([file[file.length-1][0]+1, desc, "You", date, name]);
    fs.writeFileSync(__dirname +"/data/conversations/"+ticket_id+".json", JSON.stringify (messages, null, 4), err => {
        if(err) throw err;
      })
      try{
      client.channels.cache.find(channel => channel.name === `ticket-${ticket_id}`).send(desc, {files: [`G:/TicketSupport/public/uploads/images/${req.files[0].originalname}`]})
    }catch(err){
        client.channels.cache.find(channel => channel.name === `ticket-${ticket_id}`).send(desc)
    }
      res.redirect("http://localhost/ticket/"+ticket_id)
})

//---------------------------------------------------------------------Discord Bot Area--------------------------------------------------------------------------------------------------------------------


client.on("message", async function(message){
    //Close the ticket
    if(message.content.startsWith("!close")){
        if(message.channel.name.startsWith("ticket-")){
            var ticket_id = message.channel.name.slice(7)
                var ticketchannels_raw = fs.readFileSync(__dirname + "/data/channels.json")
                    ticketchannels = JSON.parse(ticketchannels_raw)
                        if(!ticketchannels[ticket_id]) return message.channel.send("Oops, there is no ticket with the ID "+ticket_id+" in my Database")
                        if(ticketchannels[ticket_id].channel != message.channel.id) return message.channel.send("Oops, This is not the right channel for the Ticket with the ID "+ticket_id)
                message.channel.send("This ticket will close in 5 seconds").then(async function(){
                  setTimeout(()=>{
                    delete ticketchannels[ticket_id]
                    fs.writeFileSync(__dirname + "/data/channels.json", JSON.stringify (ticketchannels, null, 4), err => {
                        if(err) throw err;
                      })
                    fs.unlinkSync(__dirname +"/data/conversations/"+ticket_id+".json")
                    fs.unlinkSync(__dirname +"/data/other/"+ticket_id+".json")
                        return message.channel.delete();
                  },5000)  
                })
        }else{
            message.channel.send("Haha, very funny... This is not a ticket")
        }
    }

    //catches the message which was send in the ticket channel on discord and creates a new message entry (as you might see, if your message starts with "hdfuipgzhöadfhgjköafhgjköadfhgjkaösdhfjköahdfjköahdfgjköhgdöfgh", there will be no new message created)
    if(!message.content.startsWith("hdfuipgzhöadfhgjköafhgjköadfhgjkaösdhfjköahdfjköahdfgjköhgdöfgh")){
        if(!message.channel.name.startsWith("ticket")) return
        if(message.author.bot) return
        var ticket_id = message.channel.name.slice(7)
        var today = new Date();
        var dd = String(today.getDate()).padStart(2, '0');
        var mm = String(today.getMonth() + 1) //January is 0!
        var yyyy = today.getFullYear();
        var hh = today.getHours();
        var mm = today.getMinutes();
        var date = dd + '.' + mm + '.' + yyyy +" "+ hh+":" +mm;
        var messages_raw = fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json")
        var messages = JSON.parse(messages_raw)
        var file = JSON.parse(fs.readFileSync(__dirname +"/data/conversations/"+ticket_id+".json"));
        var desc = message.content
        var other_stuff = JSON.parse(fs.readFileSync(__dirname+"/data/other/"+ticket_id+".json"))
        if(other_stuff.claimed == "Waiting for Agent") {
            other_stuff.claimed = message.author.tag
            console.log("Yikes")
        fs.writeFileSync(__dirname +"/data/other/"+ticket_id+".json", JSON.stringify (other_stuff, null, 4), err => {
            if(err) throw err;
          })
        }
        messages.push([file[file.length-1][0]+1, desc, "Mod", date]);
        fs.writeFileSync(__dirname +"/data/conversations/"+ticket_id+".json", JSON.stringify (messages, null, 4), err => {
            if(err) throw err;
          })
         
    }
})

//-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Login Bot
client.login(token)
client.on("ready", ()=>{
    console.log("Bot has successfully logged in")
    client.user.setActivity(`with a lot of tickets...`);
})

//Login Webserver
app.listen("80", ()=>{
    console.log("Website has successfully logged in")
})
