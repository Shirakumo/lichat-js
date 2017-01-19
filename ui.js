var LichatUI = function(chat,client){
    var self = this;
    var client = client;

    var channels = chat.querySelector(".lichat-channel-list");
    var users = chat.querySelector(".lichat-user-list");
    var output = chat.querySelector(".lichat-output");
    var input = chat.querySelector(".lichat-input");

    self.commandPrefix = "/";
    self.channel = null;
    self.commands = {};

    self.objectColor = function(object){
        var hash = cl.sxhash(object);
        var encoded = hash % 0xFFFFFF;
        var r = (encoded&0xFF0000)>>16, g = (encoded&0x00FF00)>>8, b = (encoded&0x0000FF)>>0
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(200, Math.max(50, g))
            +","+Math.min(200, Math.max(50, b))+")";
    }

    self.formatTime = function(time){
        var date = new Date(time*1000);
        var pd = function(a){return (a<10)?"0"+a:""+a;}
        return pd(date.getHours())+":"+pd(date.getMinutes())+":"+pd(date.getSeconds());
    }

    self.invokeCommand = function(command){
        var args = Array.prototype.slice.call(arguments);
        var fun = self.commands[args.shift().toLowerCase()];
        if(fun){
            fun.apply(self, args);
        }else{
            throw "No such command "+command
        }
    };

    self.addCommand = function(prefix, handler){
        self.commands[prefix] = handler;
    };

    self.removeCommand = function(prefix){
        delete self.commands[prefix];
    };

    self.processCommand = function(command){
        if(command.indexOf(self.commandPrefix) === 0){
            var args = command.substring(self.commandPrefix.length).split(" ");
            self.invokeCommand.apply(self, args);
            return true;
        }
        return false;
    };

    self.sendMessage = function(text, channel){
        if(channel === undefined) channel = self.channel;
        if(!channel) throw "No active channel to send a message to."
        client.s("MESSAGE", {channel: channel, text: text});
    };
    
    self.processInput = function(text, chan){
        if(text === undefined){
            text = input.value;
            input.value = "";
        }
        try{
            self.processCommand(text, chan) ||
                self.sendMessage(text, chan);
        }catch(e){
            self.showError(e);
        }
    };

    self.constructElement = function(tag, options){
        var el = document.createElement(tag);
        el.setAttribute("class", (options.classes||[]).join(" "));
        if(options.html) el.innerHTML = options.html;
        if(options.text) el.innerText = options.text;
        for(var attr in (options.attributes||{})){
            el.setAttribute(attr, options.attributes[attr]);
        }
        for(var tag in (options.elements||{})){
            var sub = self.constructElement(tag, options.elements[tag]);
            el.appendChild(sub);
        }
        return el;
    };

    self.channelElement = function(name){
        var channel = output.querySelector("[data-channel=\""+name+"\"]");
        if(!channel) throw "No channel named "+name+" exists.";
        return channel;
    };

    self.showMessage = function(options){
        if(!options.clock) options.clock = cl.getUniversalTime();
        if(!options.from) options.from = "System";
        if(!options.type) options.type = "INFO";
        if(!options.channel) options.channel = self.channel;
        if(!options.text) throw "Can't show a message without text!";
        var el = self.constructElement("div", {
            classes: ["message", options.type.toLowerCase()],
            elements: {"time": {text: self.formatTime(cl.universalToUnix(options.clock))},
                       "a": {text: options.from,
                             attributes: {style: "color:"+self.objectColor(options.from)}},
                       "span": {text: options.text}}
        });
        self.channelElement(options.channel).appendChild(el);
        return el;
    };

    self.showError = function(e){
        return self.showMessage({from: "System",
                                 text: e+""});
    };

    self.addChannel = function(name){
        var el = self.constructElement("div", {
            classes: ["lichat-channel"],
            attributes: {"data-channel": name, "style": "display:none;"}
        });
        el.users = [];
        output.appendChild(el);
        var menu = self.constructElement("a", {
            text: name,
            classes: [(name.indexOf("@")===0)? "anonymous"
                      :(name === client.servername)? "primary"
                      :  "regular"],
            attributes: {"data-channel": name}
        });
        menu.addEventListener("click", function(){
            self.changeChannel(name);
        });
        channels.appendChild(menu);
        return self.changeChannel(name);
    };

    self.removeChannel = function(name){
        output.removeChild(self.channelElement(name));
        channels.removeChild(channels.querySelectorr("[data-channel=\""+name+"\"]"));
        return self.changeChannel(client.servername);
    };

    self.changeChannel = function(name){
        var channel = self.channelElement(name);
        if(self.channel) self.channelElement(self.channel).style.display = "none";
        if(channels.querySelector(".active"))
            channels.querySelector(".active").classList.remove("active");
        channels.querySelector("[data-channel=\""+name+"\"]").classList.add("active");
        channel.style.display = "";
        self.channel = name;
        return channel;
    };

    self.addUser = function(name, channel){
        channel = self.channelElement(channel || self.channel);
        cl.pushnew(name, channel.users);
        if(channel.dataset.name === self.channel){
            self.rebuildUserList();
        }
    };

    self.removeUser = function(name, channel){
        channel = self.channelElement(channel || self.channel);
        channel.users = cl.remove(name, channel.users);
        if(channel.dataset.name === self.channel){
            self.rebuildUserList();
        }
    };

    self.rebuildUserList = function(){
        users.innerHTML = "";
        for(name of self.channelElement(self.channel).users){
            var menu = self.constructElement("a", {
                text: name,
                classes: [(name === client.servername)? "server"
                          : "regular"],
                attributes: {"data-user": name,
                             "style": "color:"+self.objectColor(name)}
            });
            users.appendChild(menu);
        }
    }

    client.addHandler("MESSAGE", function(update){
        self.showMessage(update);
    });

    client.addHandler("JOIN", function(update){
        if(update.from === client.username){
            self.addChannel(update.channel);
            client.s("USERS", {channel: update.channel});
        }
        self.addUser(update.from, update.channel);
        update.text = " ** joined "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("LEAVE", function(update){
        if(update.from === client.username){
            self.removeChannel(update.channel);
        }
        self.removeUser(update.from, update.channel);
        update.text = " ** left "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("USERS", function(update){
        var channel = self.channelElement(update.channel);
        channel.users = update.users;
        if(update.channel === self.channel){
            self.rebuildUserList();
        }
    });

    self.addCommand("create", function(name){
        client.s("CREATE", {channel: name});
    });

    self.addCommand("join", function(name){
        if(!name) throw "You must supply the name of the channel to join."
        client.s("JOIN", {channel: name});
    });

    self.addCommand("leave", function(name){
        if(!name) name = self.channel;
        client.s("LEAVE", {channel: name});
    });

    self.initControls = function(){
        input.addEventListener("keydown", function(ev){
            if(ev.keyCode === 13 && ev.ctrlKey){
                self.processInput();
                return false;
            }
        });
    };

    self.initControls();

    return self;
}
