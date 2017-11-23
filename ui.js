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

    self.objectColor = (object)=>{
        var hash = cl.sxhash(object);
        var encoded = hash % 0xFFFFFF;
        var r = (encoded&0xFF0000)>>16, g = (encoded&0x00FF00)>>8, b = (encoded&0x0000FF)>>0
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(180, Math.max(80, g))
            +","+Math.min(180, Math.max(80, b))+")";
    }

    self.formatTime = (time)=>{
        var date = new Date(time*1000);
        var pd = (a)=>{return (a<10)?"0"+a:""+a;}
        return pd(date.getHours())+":"+pd(date.getMinutes())+":"+pd(date.getSeconds());
    }

    self.invokeCommand = (command, ...args)=>{
        var fun = self.commands[command];
        if(fun){
            fun.apply(self, args);
        }else{
            cl.error("NO-SUCH-COMMAND", {command: command});
        }
    };

    self.addCommand = (prefix, handler, documentation)=>{
        handler.documentation = documentation
        self.commands[prefix] = handler;
    };

    self.removeCommand = (prefix)=>{
        delete self.commands[prefix];
    };

    self.processCommand = (command)=>{
        if(command.indexOf(self.commandPrefix) === 0){
            var args = command.substring(self.commandPrefix.length).split(" ");
            self.invokeCommand.apply(self, args);
            return true;
        }
        return false;
    };

    self.sendMessage = (text, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        client.s("MESSAGE", {channel: channel, text: text});
    };

    self.sendFile = (file, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        console.log("Reading file",file);
        var reader = new FileReader();
        reader.onload = ()=>{
            var base64 = reader.result.substring(reader.result.indexOf(",")+1);
            console.log(base64.length);
            client.s("DATA", {"channel": channel,
                              "payload": base64,
                              "content-type": file.type,
                              "filename": file.name});
        };
        reader.onerror = (e)=>{
            self.showError(e);
        };
        reader.readAsDataURL(file);
    };
    
    self.processInput = (text, chan)=>{
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

    var autoComplete = {index: 0,
                        prefix: null,
                        pretext: null};
    self.autoCompleteInput = (text, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(text === undefined) text = input.value;

        if(autoComplete.prefix === null){
            autoComplete.index = 0;
            autoComplete.prefix = text.split(" ").splice(-1)[0].toLowerCase();
            autoComplete.pretext = text.substr(0, text.length-autoComplete.prefix.length);
        }
        
        var matchingNames = [];
        for(var user of self.channelElement(channel).users){
            if(user.toLowerCase().indexOf(autoComplete.prefix) === 0 &&
               user !== client.username)
                matchingNames.push(user);
        }
        if(0 < matchingNames.length){
            matchingNames = cl.sort(matchingNames, cl.lt);
            input.value = autoComplete.pretext+matchingNames[autoComplete.index]
                + ((autoComplete.pretext === "")? ": ": " ");
            autoComplete.index = (autoComplete.index+1)%matchingNames.length;
        }
    }

    self.constructElement = (tag, options)=>{
        var el = document.createElement(tag);
        el.setAttribute("class", (options.classes||[]).join(" "));
        if(options.text) el.innerText = options.text;
        if(options.html) el.innerHTML = options.html;
        for(var attr in (options.attributes||{})){
            el.setAttribute(attr, options.attributes[attr]);
        }
        for(var tag in (options.elements||{})){
            var sub = self.constructElement(tag, options.elements[tag]);
            el.appendChild(sub);
        }
        return el;
    };

    self.channelElement = (name)=>{
        name = name.toLowerCase();
        var channel = output.querySelector("[data-channel=\""+name+"\"]");
        if(!channel) cl.error("NO-SUCH-CHANNEL",{channel:name});
        return channel;
    };

    self.channelExists = (name)=>{
        try{self.channelElement(name);
            return true;
           }catch(e){return false;}
    };

    self.showMessage = (options)=>{
        if(!options.clock) options.clock = cl.getUniversalTime();
        if(!options.from) options.from = "System";
        if(!options.type) options.type = "INFO";
        if(!options.channel) options.channel = self.channel;
        if(!options.text && !options.html) cl.error("NO-MESSAGE-TEXT",{message:options});
        if(cl.classOf(options)){
            classList = cl.mapcar((a)=>a.className.toLowerCase(), cl.classOf(options).superclasses);
            classList.push(cl.classOf(options).className);
        }else{
            classList = ["update"];
        }
        var timestamp = cl.universalToUnix(options.clock);
        var el = self.constructElement("div", {
            classes: classList,
            elements: {"time": {text: self.formatTime(timestamp),
                                attributes: {datetime: ""+timestamp}},
                       "a": {text: options.from,
                             attributes: {style: "color:"+self.objectColor(options.from),
                                          title: options.from}},
                       "span": {text: options.text, html: options.html}}
        });
        var channel = self.channelElement(options.channel);
        var currentScroll = channel.scrollHeight - channel.scrollTop - channel.clientHeight;
        var inserted = false;
        for(var child of channel.childNodes){
            var datetime = child.querySelector("time").getAttribute("datetime");
            if(timestamp < parseInt(datetime)){
                channel.insertBefore(el, child);
                inserted = true;
                break;
            }
        }
        if(!inserted){
            channel.appendChild(el);
        }
        
        if(currentScroll<10){
            channel.scrollTop = channel.scrollHeight + el.clientHeight;
        }
        return el;
    };

    self.showError = (e)=>{
        if(e instanceof Condition){
            return self.showMessage({from: "System",
                                     text: ""+e.report()});
        }else{
            return self.showMessage({from: "System",
                                     text: e+""});
        }
    };

    self.addChannel = (name)=>{
        name = name.toLowerCase();
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
        menu.addEventListener("click", ()=>{
            self.changeChannel(name);
        });
        channels.appendChild(menu);
        return self.changeChannel(name);
    };

    self.removeChannel = (name)=>{
        name = name.toLowerCase();
        output.removeChild(self.channelElement(name));
        channels.removeChild(channels.querySelector("[data-channel=\""+name+"\"]"));
        self.channel = null;
        return self.changeChannel(client.servername);
    };

    self.changeChannel = (name)=>{
        name = name.toLowerCase();
        var channel = self.channelElement(name);
        if(self.channel) self.channelElement(self.channel).style.display = "none";
        if(channels.querySelector(".active"))
            channels.querySelector(".active").classList.remove("active");
        channels.querySelector("[data-channel=\""+name+"\"]").classList.add("active");
        channel.style.display = "";
        self.channel = name;
        self.rebuildUserList();
        return channel;
    };

    self.addUser = (name, channel)=>{
        channel = self.channelElement(channel || self.channel);
        cl.pushnew(name, channel.users);
        self.rebuildUserList();
    };

    self.removeUser = (name, channel)=>{
        channel = self.channelElement(channel || self.channel);
        channel.users = cl.remove(name, channel.users);
        self.rebuildUserList();
    };

    self.rebuildUserList = ()=>{
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
    };

    self.reset = ()=>{
        if(output) output.innerHTML = "";
        if(users) users.innerHTML = "";
        if(channels) channels.innerHTML = "";
        self.channel = null;
    };
    
    var URLRegex = new RegExp("((?:[\\w\\-_]+:\\/\\/)([\\w_\\-]+(?:(?:\\.[\\w_\\-]+)+))(?:[\\w.,@?^=%&:/~+#\\-()]*[\\w@?^=%&/~+#\\-])?)", "g");
    self.linkifyURLs = (text)=>{
        return text.replace(URLRegex,
                            (match, url)=>{
                                return "<a href=\""+self.unescapeHTML(url)+"\" class=\"userlink\" target=\"_blank\">"+url+"</a>"
                            });
    };

    self.prewrapURLs = (text)=>{
        return text.replace(URLRegex, "\u200B$&\u200B");
    };

    self.unescapeHTML = (text)=>{
        return text.replace(/&([\w]+);/g, (a,b)=>{
            switch(b){
            case "lt": return "<";
            case "gt": return ">";
            case "quot": return "\"";
            case "amp": return "&";
            default: return a;
            }
        });
    }

    self.escapeHTML = (text)=>{
        return text.replace(/([<>"&\n])/g, (a,b)=>{
            switch(b){
            case "<": return "&lt;"
            case ">": return "&gt;"
            case "\"": return "&quot;"
            case "&": return "&amp;"
            case "\n": return "<br>"
            default: return a;
            }
        });
    };

    self.escapeRegex = (text)=>{
        return text.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    self.markSelf = (text, name)=>{
        name = name || client.username || "anonymous";
        var stream = new LichatStream();
        var inLink = false;
        for(var i=0; i<text.length; i++){
            if(!inLink && text.substring(i, i+name.length) === name){
                stream.writeString("<mark>"+name+"</mark>");
                i += name.length-1;
            }else{
                if(!inLink && text[i] === "<" && text[i+1] === "a"){
                    inLink = true;
                }else if(inLink && text[i] === ">"){
                    inLink = false;
                }
                stream.writeChar(text[i]);
            }
        }
        return stream.string;
    };

    self.replaceEmotes = (text)=>{
        // Find starting point
        var start = 0;        
        while(text[start] != ':' && start<text.length) start++;
        // If we do have colons in, scan for emotes.
        if(start < text.length){
            var out = text.slice(0, start);
            // Scan for next colon
            for(var end=start+1; end<text.length; end++){
                if(text[end] == ':'){
                    var emote = text.slice(start, end+1);
                    // If we do have an emote of that name
                    if(client.emotes[emote]){
                        out = out+client.emotes[emote];
                        // Scan ahead for next possible end point after "skipping" the emote.
                        end++;
                        start = end;
                        while(text[end] != ':' && end<text.length) end++;
                    }else{
                        out = out+emote.slice(0, -1);
                        start = end;
                    }
                }
            }
            // Stitch on ending
            return out+text.slice(start,end);
        }else{
            return text;
        }
    };

    self.formatUserText = (text)=>{
        return self.replaceEmotes(self.markSelf(self.linkifyURLs(self.escapeHTML(self.prewrapURLs(text)))));
    };

    var updates = 0;
    var title = document.title;
    self.notify = (update)=>{
        updates++;
        document.title = "("+updates+") "+title;
    };

    document.addEventListener("visibilitychange", (ev)=>{
        if(document.hidden){
            updates = 0;
        }else{
            document.title = title;
        }
    });

    client.addHandler("MESSAGE", (update)=>{
        if(document.hidden){
            self.notify(update);
        }
        update.html = self.formatUserText(update.text);
        self.showMessage(update);
    });

    client.addHandler("DATA", (update)=>{
        switch(update["content-type"]){
        case "image/gif":
        case "image/jpeg":
        case "image/png":
        case "image/svg+xml":
            var link = "data:"+update["content-type"]+";base64,"+update["payload"];
            update.html = "<img class=\"data\" alt=\""+update["filename"]+"\" title=\""+update["filename"]+"\" src=\""+link+"\" />";
            break;
        case "audio/wave":
        case "audio/wav":
        case "audio/x-wav":
        case "audio/x-pn-wav":
        case "audio/webm":
        case "audio/ogg":
        case "audio/mpeg":
        case "audio/mp3":
        case "audio/mp4":
        case "audio/flac":
            update.html = "<audio class=\"data\" controls><source src=\"data:"+update["content-type"]+";base64,"+update["payload"]+"\" type=\""+update["content-type"]+"\"></audio>";
            break;
        case "video/webm":
        case "video/ogg":
        case "video/mp4":
        case "application/ogg":
            update.html = "<video class=\"data\" controls><source src=\"data:"+update["content-type"]+";base64,"+update["payload"]+"\" type=\""+update["content-type"]+"\"></video>";
            break;
        default:
            update.html = "<div class=\"data unsupported\">Unsupported data of type "+update["content-type"]+"</div>";
        }
        self.showMessage(update);
    });

    client.addHandler("JOIN", (update)=>{
        if(update.from === client.username){
            self.addChannel(update.channel);
            self.changeChannel(update.channel);
            client.s("USERS", {channel: update.channel});
        }
        self.addUser(update.from, update.channel);
        update.text = " ** joined "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("LEAVE", (update)=>{
        if(update.from === client.username){
            self.removeChannel(update.channel);
        }
        self.removeUser(update.from, update.channel);
        update.text = " ** left "+update.channel;
        self.showMessage(update);
    });

    client.addHandler("USERS", (update)=>{
        var channel = self.channelElement(update.channel);
        channel.users = update.users;
        if(update.channel === self.channel){
            self.rebuildUserList();
        }
    });

    client.addHandler("CHANNELS", (update)=>{
        update.text = "Channels: "+update.channels.join(", ");
        self.showMessage(update);
    });

    client.addHandler("REGISTER", (update)=>{
        update.text = " ** the password has been updated.";
        self.showMessage(update);
    });

    client.addHandler("FAILURE", (update)=>{
        self.showMessage(update);
    });

    client.addHandler("UPDATE", (update)=>{
        // Some events are uninteresting, so they should be ignored entirely.
        if(!cl.find(cl.classOf(update).className,
                    ["PING", "PONG", "EMOTES", "EMOTE"])){
            if(!update.text) update.text = "Received update of type "+update.type;
            self.showMessage(update);
        }
    });

    self.addCommand("help", ()=>{
        var text = "Available commands:";
        for(var name in self.commands){
            text += "<br/><label class='command'>"+self.commandPrefix+name+"</label>"
                +(self.commands[name].documentation || "")
        }
        self.showMessage({html: text});
    }, "Show all available commands");

    self.addCommand("register", (password)=>{
        if(password.length<6)
            cl.error("PASSWORD-TOO-SHORT",{text: "Your password must be at least six characters long."});
        client.s("REGISTER", {password: password});
    }, "Register your username with a password.");

    self.addCommand("create", (name)=>{
        if(!name) name = null;
        client.s("CREATE", {channel: name});
    }, "Create a new channel. Not specifying a name will create an anonymous channel.");

    self.addCommand("join", (name)=>{
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of the channel to join."});
        if(self.channelExists(name)){
            self.changeChannel(name);
        }else{
            client.s("JOIN", {channel: name});
        }
    }, "Join an existing channel.");

    self.addCommand("leave", (name)=>{
        if(!name) name = self.channel;
        if(self.channelExists(name))
            client.s("LEAVE", {channel: name});
    }, "Leave a channel. Not specifying a name will leave the current channel.");

    self.addCommand("pull", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to pull."});
        if(!name) name = self.channel;
        client.s("PULL", {channel:name, target:user});
    }, "Pull a user into a channel. Not specifying a name will leave the current channel.");

    self.addCommand("kick", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to kick."});
        if(!name) name = self.channel;
        client.s("KICK", {channel:name, target:user});
    }, "Kick a user from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("users", (name)=>{
        if(!name) name = self.channel;
        client.s("USERS", {channel:name});
    }, "Fetch a list of users from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("channels", ()=>{
        client.s("CHANNELS", {});
    }, "Fetch a list of public channels.");

    self.addCommand("info", (user)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to query."});
        client.s("USER-INFO", {target:user});
    }, "Fetch information about a user.");

    self.addCommand("message", (name, ...args)=>{
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a channel to message to."});;
        client.s("KICK", {channel:name, text:args.join(" ")});
    }, "Send a message to a channel. Note that you must be in the channel to send to it.");

    self.addCommand("contact", (...users)=>{
        if(users.length === 0) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of at least one user to contact."});;
        var update = cl.makeInstance("CREATE",{from: client.username});
        client.addCallback(update.id, (update)=>{
            if(update.type === "JOIN"){
                for(var user of users){
                    client.s("PULL", {channel: update.channel, target: user});
                }
            }else{
                self.showError("Failed to create anonymous channel for contacting.");
            }
        });
        client.send(update);
    }, "Contact one or more users in an anonymous channel.");

    self.addCommand("clear", ()=>{
        if(output) output.innerHTML = "";
    }, "Clear all messages from the channel.");

    self.addCommand("emotes", ()=>{
        var emotes = Object.keys(client.emotes).sort((a,b)=>{return a.localeCompare(b);});
        var text = "Available emotes:";
        for(var emote in client.emotes){
            text += "<br/><label class='emote'>"+emote+"</label> "+client.emotes[emote];
        }
        self.showMessage({html: text});
    }, "Show the available emotes.");

    self.initControls = ()=>{
        input.addEventListener("keydown", (ev)=>{
            if(ev.keyCode === 9){
                ev.preventDefault();
                self.autoCompleteInput();
                return false;
            }else{
                autoComplete.prefix = null;
            }
            if(ev.keyCode === 13){
                ev.preventDefault();
                if(!ev.ctrlKey || input.tagName.toLowerCase() === "input"){
                    self.processInput();
                }else{
                    input.value = input.value+"\n";
                }
                return false;
            }
        });
    };

    self.initControls();

    return self;
}
