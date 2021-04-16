var LichatUI = function(chat, cclient){
    var self = this;
    var client = cclient;

    var channels = chat.querySelector(".lichat-channel-list");
    var users = chat.querySelector(".lichat-user-list");
    var output = chat.querySelector(".lichat-output");
    var input = chat.querySelector(".lichat-input");
    var topic = chat.querySelector(".lichat-topic");

    var updates = 0;
    var title = document.title;

    self.commandPrefix = "/";
    self.channel = null;
    self.channelSettings = {};
    self.userSettings = {};
    self.notifyBy = [];
    self.commands = {};
    self.notifySound = chat.querySelector(".lichat-notify");
    self.notifySound.volume = 0.5;
    self.icon = document.querySelector("head link[rel=\"shortcut icon\"]");
    self.icon = (self.icon)?self.icon.getAttribute("href"):"/favicon.ico";
    self.css = document.createElement("style");
    document.head.appendChild(self.css);
    self.css = self.css.sheet;
    
    self.save = (name, value)=>{
        if(name == undefined){
            self.save("channelSettings", self.channelSettings);
            self.save("userSettings", self.userSettings);
            self.save("notifyBy", self.notifyBy);
            self.save("notifySound.volume", self.notifySound.volume);
            return self;
        }else if(window.localStorage){
            window.localStorage.setItem("lichat.ui."+name, JSON.stringify(value));
            return value;
        }else{
            return value;
        }
    };

    self.load = (name, def)=>{
        if(name == undefined){
            self.channelSettings = self.load("channelSettings", self.channelSettings);
            self.userSettings = self.load("userSettings", self.userSettings);
            self.notifyBy = self.load("notifyBy", self.notifyBy);
            self.notifySound.volume = self.load("notifySound.volume", self.notifySound.volume);
            return self;
        }else if(window.localStorage){
            var value = window.localStorage.getItem("lichat.ui."+name);
            return (value)? JSON.parse(value) : def;
        }else{
            return def;
        }
    };

    self.objectColor = (object)=>{
        var hash = cl.sxhash(object);
        var encoded = hash % 0xFFF;
        var r = 16*(1+(encoded&0xF00)>>8)-1;
        var g = 16*(1+(encoded&0x0F0)>>4)-1;
        var b = 16*(1+(encoded&0x00F)>>0)-1;
        
        return "rgb("+Math.min(200, Math.max(50, r))
            +","+Math.min(180, Math.max(80, g))
            +","+Math.min(180, Math.max(80, b))+")";
    };

    self.formatTime = (time)=>{
        var date = new Date(time*1000);
        var pd = (a)=>{return (a<10)?"0"+a:""+a;};
        return pd(date.getHours())+":"+pd(date.getMinutes())+":"+pd(date.getSeconds());
    };

    self.invokeCommand = (command, ...args)=>{
        cl.format("Command ~a~a", command, args);
        var fun = self.commands[command];
        if(fun){
            fun.apply(self, args);
        }else{
            cl.error("NO-SUCH-COMMAND", {command: command});
        }
    };

    self.addCommand = (prefix, handler, documentation)=>{
        handler.documentation = documentation;
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

    self.sendEdit = (text, id, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        client.s("EDIT", {channel: channel, id: id, text: text});
    };

    self.sendFile = (file, channel)=>{
        if(channel === undefined) channel = self.channel;
        if(!channel) cl.error("NO-ACTIVE-CHANNEL");
        var reader = new FileReader();
        reader.onload = ()=>{
            var base64 = reader.result.substring(reader.result.indexOf(",")+1);
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
        
        var matches = [];
        for(var user of self.channelElement(channel).users){
            if(user.toLowerCase().indexOf(autoComplete.prefix) === 0 &&
               user !== client.username)
                matches.push(user);
        }
        for(var emote in client.emotes){
            if(emote.toLowerCase().indexOf(autoComplete.prefix) === 0)
                matches.push(emote);
        }
        if(0 < matches.length){
            matches = cl.sort(matches, cl.lt);
            var match = matches[autoComplete.index];
            input.value = autoComplete.pretext+match
                + ((autoComplete.pretext === "" && match[match.length-1] !== ":")? ": ": " ");
            autoComplete.index = (autoComplete.index+1)%matches.length;
        }
    };

    self.constructElement = (tag, options)=>{
        var el = document.createElement(tag);
        if(options.classes) el.setAttribute("class", (options.classes||[]).join(" "));
        if(options.html) el.innerHTML = options.html;
        if(options.id) el.setAttribute("id", id);
        for(var attr in (options.attributes||{})){
            if(options.attributes[attr])
                el.setAttribute(attr, options.attributes[attr]);
        }
        for(var i in (options.elements||[])){
            var sub = options.elements[i];
            if(!(sub instanceof HTMLElement))
                sub = self.constructElement(sub.tag, sub);
            el.appendChild(sub);
        }
        for(var data in (options.dataset||{})){
            el.dataset[data] = options.dataset[data];
        }
        for(var attr in (options.style||{})){
            el.style[attr] = options.style[data];
        }
        for(var handler in (options.handlers||{})){
            el.addEventListener(handler,options.handlers[handler]);
        }
        if(options.text) el.appendChild(document.createTextNode(options.text));
        return el;
    };

    self.popup = (content, okCallback)=>{
        let el = null;
        el = {
            classes: ["popup-background"],
            elements: [{
                tag: "div",
                classes: ["popup"],
                attributes: {"style": "display:block"},
                elements: [
                    content,
                ]
            }],
            handlers: {click: (ev)=>{
                if(ev.target == el) document.body.removeChild(el);
            }}
        };
        if(okCallback){
            el.elements[0].elements.push({
                tag: "button", 
                attributes: {"type": "submit"}, 
                text: "Ok",
                handlers: {click: ()=>{
                    if(okCallback) okCallback(el);
                    document.body.removeChild(el);
                }}
            });
        }
        el = self.constructElement("div", el);
        document.body.appendChild(el);
        return el;
    };

    self.promptIcon = (cb)=>{
        var pop = self.popup({tag: "div", elements:[
            {tag: "img", classes: ["icon"]},
            {tag: "input", attributes: {type: "file", accept: "image/png,image/gif,*.png,*.gif"}}
        ]}, (el)=>{
            var src = el.querySelector("img").getAttribute("src");
            if(src){
                var contentType = src.substr(0, src.indexOf(";"));
                var b64 = src.substr(src.indexOf(",")+1);
                cb(contentType+" "+b64);
            }
        });
        var image = pop.querySelector("img");
        var file = pop.querySelector("input[type=file]");
        file.addEventListener("change", ()=>{
            var fr = new FileReader();
            fr.onload = ()=>{
                image.src = fr.result;
            };
            fr.readAsDataURL(file.files[0]);
        });
        return pop;
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

    self.isChannelVisible = (name)=>{
        return document.visibilityState === 'visible'
            && self.channel === (name || self.channel).toLowerCase();
    };

    self.isAtBottom = (element)=>{
        element = element || channel;
        return (element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    };

    self.scrollToBottom = (element)=>{
        element.querySelector(".update:last-child").scrollIntoView();
    };

    self.ensureMessageOptions = (options)=>{
        if(!options.clock) options.clock = cl.getUniversalTime();
        if(!options.from) options.from = "System";
        if(!options.type) options.type = "INFO";
        if(!options.channel) options.channel = self.channel;
        if(!options.text && !options.html) cl.error("NO-MESSAGE-TEXT",{message:options});
        return options;
    };

    var lastInserted = null;
    self.showMessage = (options)=>{
        options = self.ensureMessageOptions(options);
        if(cl.classOf(options)){
            classList = cl.mapcar((a)=>a.className.toLowerCase(), cl.classOf(options).superclasses);
            classList.push(cl.classOf(options).className.toLowerCase());
        }else{
            classList = ["update"];
        }
        if(options.from === client.username) cl.push("self", classList);
        var timestamp = cl.universalToUnix(options.clock);
        var messageElements = [
            {
                tag: "time",
                text: self.formatTime(timestamp),
                attributes: {datetime: ""+timestamp}},
            {
                tag: "a",
                text: options.from,
                classes: ["username", cl.null(options.bridge)?"":"bridged"],
                attributes: {style: "color:"+self.objectColor(options.from),
                             title: cl.null(options.bridge)?options.from:options.bridge}},
            {
                tag: "span",
                classes: ["content"],
                html: options.html || self.escapeHTML(options.text)},
            {
                tag: "nav",
                classes: ["actions"],
                elements: []}];
        // Extended functionality
        if(client.isAvailable("shirakumo-edit") &&
           0 <= classList.indexOf("message") &&
           options.from === client.username){
            // Note: The array position for content.
            messageElements[2].handlers = {'click': handleMessageClick};
            messageElements.push({
                tag: "div",
                classes: ["edit-content", "input-area", "hidden"],
                elements: [
                    {tag: "textarea",
                     text: options.text},
                    {tag: "div",
                     elements: [
                     {tag: "input",
                      classes: ["edit-accept"],
                      attributes: {type: "submit", value: "Edit"},
                      handlers: {"click": sendEdit}},
                     {tag: "input",
                      classes: ["edit-cancel"],
                      attributes: {type: "submit", value: "Cancel"},
                      handlers: {"click": cancelEdit}}]}]
            });
        }
        if(client.isAvailable("shirakumo-reactions") && options.id){
            messageElements[3].elements.push({
                tag: "a", classes: ["action", "react"], handlers: {'click': handleReaction}
            });
            messageElements.push({
                tag: "ul",
                classes: ["reactions"]});
        }
        // Construct element
        var el = self.constructElement("div", {
            classes: classList,
            dataset: {id: options.id,from: options.from},
            attributes: {id: "message-"+options.id+"-"+options.from},
            elements: messageElements
        });
        // Handle scrolling deferral.
        var channel = self.channelElement(options.channel);
        lastInserted = el;
        if(self.isAtBottom(channel)){
            var elements = el.querySelectorAll("img,audio,video");
            for(var i=0; i<elements.length; i++){
                elements[i].addEventListener("load", function(){
                    if(lastInserted === el)
                        el.scrollIntoView();
                });
            }
        }
        // Insert element in order.
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
            el.scrollIntoView();
        }
        if(!self.isChannelVisible(options.channel) && !cl.streq(options.channel, client.servername)){
            self.updateUnreadCount(options.channel, "new");
            self.notify(options);
        }
        return el;

        function handleReaction(ev) {
            self.showEmoteList((emote)=>{
                client.s("REACT", {channel: options.channel, target: options.from, "update-id": options.id, emote: emote});
            });
        }

        function handleMessageClick(event) {
            if(el.dataset.from === client.username){
                let form = el.querySelector(".edit-content");
                if(!form.classList.toggle("hidden",false)){
                    el.querySelector(".content").classList.add("hidden");
                    document.addEventListener("click",cancelEditFromDocument);
                }
            }
        }

        function hideEdit(form){
            if(form.classList.toggle("hidden",true)){
                el.querySelector(".content").classList.remove("hidden");
                let span = el.querySelector(".content");
                form.querySelector("textarea").value = span.innerText;
                document.removeEventListener("click",cancelEditFromDocument);
            }
        }

        function cancelEdit(event){
            event.preventDefault();
            let form = event.target.closest(".edit-content");
            hideEdit(form);
            return false;
        }

        function cancelEditFromDocument(event){
            if(el !== event.target.closest(".message")){
                let form = el.querySelector(".edit-content");
                if(!form.classList.contains("hidden")) hideEdit(form);
            }
        }

        function sendEdit(event){
            event.preventDefault();
            let form = event.target.closest(".edit-content");
            let span = el.querySelector(".content");
            let text = form.querySelector("textarea").value;
            if(text !== span.innerText){
                client.s("EDIT", {
                    channel: options.channel,
                    id: options.id,
                    text: text
                });
                span.innerText = text;
            }
            hideEdit(form);
            return false;
        }
    };

    self.findMessage = (channel, from, id)=>{
        return document.getElementById("message-"+id+"-"+from);
    };

    self.showError = (e)=>{
        if(e instanceof Condition){
            if(e.type == "SOCKET-CLOSE")
                return self.showMessage({from: "System",
                                         text: "Connection failed. Attempting reconnect..."});
            else
                return self.showMessage({from: "System",
                                         text: ""+e.report()});
        }else{
            return self.showMessage({from: "System",
                                     text: e+""});
        }
    };

    self.editMessage = (options)=>{
        options = self.ensureMessageOptions(options);
        let channel = self.channelElement(options.channel);
        let shouldScroll = self.isAtBottom(channel);
        for(let child of channel.childNodes){
            if(parseInt(child.dataset.id) === options.id &&
               child.dataset.from === options.from){
                // TODO: How do we mark a message as edited?
                let span = child.querySelector("span.content");
                if(options.text) span.innerText = options.text;
                if(options.html) span.innerHTML = options.html;
                break;
            }
        }
        if(shouldScroll) self.scrollToBottom(channel);
    };

    self.addChannel = (n)=>{
        let name = n.toLowerCase();
        var existing = document.querySelector(".lichat-channel[data-channel=\""+name+"\"]");
        if(existing) return existing;
        
        var el = self.constructElement("div", {
            classes: ["lichat-channel"],
            attributes: {"data-channel": name, "style": "display:none;"}
        });
        var settings = self.channelSettings[name] || {};
        self.channelSettings[name] = settings;
        el.users = [];
        output.appendChild(el);
        let menu = self.constructElement("a", {
            text: name,
            classes: [(name.indexOf("@")===0)? "anonymous"
                      :(name === client.servername)? "primary"
                      :  "regular"],
            attributes: {"data-channel": name,
                         "style": "color:"+(settings.color || "")},
            elements: [
                {tag: "span", classes:["unread"]},
                {
                tag: "nav",
                attributes: {"style": "display:none"},
                elements: [
                    {tag: "a", classes: ["info"], text: "Info"},
                    {tag: "a", classes: ["permissions"], text: "Permissions"},
                    {tag: "a", classes: ["settings"], text: "Settings"},
                    {tag: "a", classes: ["pull"], text: "Invite"},
                    {tag: "a", classes: ["leave"], text: "Leave"},
                ]
            }]
        });
        channels.appendChild(menu);
        let nav = menu.querySelector("nav");
        let hideNav;
        hideNav = ()=>{
            nav.style.display = "none";
            document.removeEventListener("click", hideNav);
        };
        let handle = (field, fn)=>{
            nav.querySelector(field).addEventListener("click", (ev)=>{
                hideNav();
                fn(ev);
            });
        };
        handle("a.info", ()=>{
            var els = [];
            for(var key in client.channels[name]){
                if(key == "unread") continue;
                els.push({
                    tag: "div",
                    classes: ["row"],
                    elements: [
                        {tag: "label", text: key},
                        {tag: "input",
                         dataset: {"key": key},
                         attributes: {type: "text", value: client.channels[name][key]}}
                    ]
                });
            }
            self.popup({tag:"div", elements: els}, (el)=>{
                for(var field of el.querySelectorAll("input[type=text]")){
                    var key = field.dataset.key;
                    if(field.value != client.channels[name][key]){
                        client.s("SET-CHANNEL-INFO", {channel: name, key: LichatReader.fromString(key), text: field.value});
                    }
                }
            });
        });
        handle("a.permissions", ()=>{
            self.popup({tag:"span", text: "TODO"});
        });
        handle("a.settings", ()=>{
            self.popup({tag:"div", elements: [
                {tag: "div", classes: ["row"], elements: [
                    {tag: "label", text: "Color"},
                    {tag: "input", attributes: {type: "color", value: settings["color"]}}
                ]},
                {tag: "div", classes: ["row"], elements: [
                    {tag: "label", text: "Notify"},
                    {tag: "select", elements: [
                        {tag: "option", text: "on messages", attributes: {value: "any", selected: settings['notify'] == "any"}},
                        {tag: "option", text: "on mentions", attributes: {value: "mention", selected: settings['notify'] == "mention"}},
                        {tag: "option", text: "never", attributes: {value: "never", selected: settings['notify'] == "never"}}
                    ]}
                ]}
            ]}, (el)=>{
                settings["color"] = el.querySelector("input[type=color]").value;
                if(settings["color"] == "#000000") delete settings["color"];
                settings["notify"] = el.querySelector("select").value;
                self.save();
                menu.style.color = settings["color"];
            });
        });
        handle("a.pull", ()=>{
            var user = window.prompt("Username to pull into "+name);
            if(user){
                client.s("PULL", {channel: name, target: user});
            }
        });
        handle("a.leave", ()=>{
            client.s("LEAVE", {channel: name});
        });
        menu.addEventListener("click", ()=>{
            self.changeChannel(name);
        });
        menu.addEventListener("contextmenu", (ev)=>{
            nav.style.display = (nav.style.display == "none")? "block" : "none";
            nav.style.top = ev.clientY+"px";
            nav.style.left = ev.clientX+"px";
            ev.preventDefault();
            document.addEventListener("click", hideNav);
        });
        return self.changeChannel(name);
    };

    self.removeChannel = (name)=>{
        name = name.toLowerCase();
        output.removeChild(self.channelElement(name));
        channels.removeChild(channels.querySelector("[data-channel=\""+name+"\"]"));
        if(self.channel == name){
            self.channel = null;
            return self.changeChannel(client.servername);
        }else{
            return self.channel;
        }
    };

    self.updateUnreadCount = (name, change)=>{
        name = name.toLowerCase();
        var el = channels.querySelector("[data-channel=\""+name+"\"] .unread");
        if(change == "new"){
            client.channels[name]["unread"] = 1 + (client.channels[name]["unread"] || 0);
            el.classList.remove("hidden");
            el.innerText = client.channels[name]["unread"];
        }else if(change == "clear"){
            client.channels[name]["unread"] = 0;
            el.classList.add("hidden");
        }
        self.updateTitle();
    };

    self.changeChannel = (name)=>{
        name = name.toLowerCase();
        var channel = self.channelElement(name);
        if(self.channel) self.channelElement(self.channel).style.display = "none";
        if(channels.querySelector(".active"))
            channels.querySelector(".active").classList.remove("active");
        channels.querySelector("[data-channel=\""+name+"\"]").classList.add("active");
        channel.style.display = "";
        if(topic){
            var text = client.channels[name][":TOPIC"];
            topic.innerHTML = self.replaceEmotes(self.linkifyURLs(self.escapeHTML(text || "")));
        }
        self.channel = name;
        self.updateUnreadCount(name, "clear");
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

    self.rebuildUserStyles = ()=>{
        while(0 < self.css.rules.length){
            self.css.deleteRule(0);
        }
        for(var name in self.userSettings){
            var settings = self.userSettings[name];
            if(settings["color"]){
                self.css.insertRule(".update[data-from=\""+name+"\"] .username{color: "+settings["color"]+" !important}", 0);
            }
            if(settings["ignore"]){
                self.css.insertRule(".update[data-from=\""+name+"\"]{display: none !important;}", 0);
            }
        }
    };

    self.rebuildUserList = ()=>{
        users.innerHTML = "";
        for(let name of self.channelElement(self.channel).users){
            let settings = self.userSettings[name] || {};
            let menu = self.constructElement("a", {
                text: name,
                classes: [(name === client.servername)? "server" : "regular"],
                attributes: {"data-user": name,
                             "style": "color:"+(settings["color"] || self.objectColor(name))},
                elements: [{
                    tag: "nav",
                    attributes: {"style": "display:none"},
                    elements: [
                        {tag: "a", classes: ["info"], text: "Info"},
                        {tag: "a", classes: ["quiet"], text: "Quiet"},
                        {tag: "a", classes: ["unquiet"], text: "Unquiet"},
                        {tag: "a", classes: ["kick"], text: "Kick"},
                        {tag: "a", classes: ["kickban"], text: "Kickban"},
                        {tag: "a", classes: ["block"], text: "Block"},
                        {tag: "a", classes: ["settings"], text: "Settings"},
                    ]
                }]
            });
            users.appendChild(menu);
            let nav = menu.querySelector("nav");
            let hideNav;
            hideNav = ()=>{
                nav.style.display = "none";
                document.removeEventListener("click", hideNav);
            };
            let handle = (field, fn)=>{
                nav.querySelector(field).addEventListener("click", (ev)=>{
                    hideNav();
                    fn(ev);
                });
            };
            handle("a.info", ()=>{
                self.invokeCommand("info", name);
            });
            handle("a.kick", ()=>{
                client.s("KICK", {channel: self.channel, target: name});
            });
            handle("a.quiet", ()=>{
                client.s("QUIET", {channel: self.channel, target: name});
            });
            handle("a.unquiet", ()=>{
                client.s("UNQUIET", {channel: self.channel, target: name});
            });
            handle("a.kickban", ()=>{
                if(window.confirm("Are you sure you want to ban "+name+" from "+self.channel+"?")){
                    client.s("DENY", {channel: self.channel, target: name, update: cl.li("JOIN")});
                    client.s("KICK", {channel: self.channel, target: name});
                }
            });
            handle("a.block", ()=>{
                if(window.confirm("Are you sure you want to block "+name+"? You will no longer receive any messages from them. In order to unblock them again, use the /unblock command.")){
                    client.s("BLOCK", {target: name});
                }
            });
            handle("a.settings", ()=>{
                self.popup({tag: "div", elements: [
                    {tag: "div", classes: ["row"], elements: [
                        {tag: "label", text: "Color"},
                        {tag: "input", attributes: {type: "color", value: settings["color"]}}
                    ]},
                    {tag: "div", classes: ["row"], elements: [
                        {tag: "label", text: "Ignore"},
                        {tag: "input", attributes: {type: "checkbox", value: "on", checked: settings["ignore"]}}
                    ]}
                ]}, (el)=>{
                    settings["color"] = el.querySelector("input[type=color]").value;
                    if(settings["color"] == "#000000") delete settings["color"];
                    settings["ignore"] = el.querySelector("input[type=checkbox]").checked;
                    self.userSettings[name] = settings;
                    self.save();
                    self.rebuildUserStyles();
                    menu.style.color = settings["color"] || self.objectColor(name);
                });
            });
            menu.addEventListener("contextmenu", (ev)=>{
                nav.style.display = (nav.style.display == "none")? "block" : "none";
                nav.style.top = ev.clientY+"px";
                nav.style.left = ev.clientX+"px";
                document.addEventListener("click", hideNav);
                ev.preventDefault();
            });
        }
    };

    self.reset = ()=>{
        if(output) output.innerHTML = "";
        if(users) users.innerHTML = "";
        if(channels) channels.innerHTML = "";
        self.channel = null;
    };
    
    // URL Regex by Diego Perini: https://gist.github.com/dperini/729294
    var URLRegex = new RegExp(
        "^" +
          // protocol identifier (optional)
          // short syntax // still required
          "(?:(?:(?:https?|ftp):)?\\/\\/)" +
          // user:pass BasicAuth (optional)
          "(?:\\S+(?::\\S*)?@)?" +
          "(?:" +
            // IP address exclusion
            // private & local networks
            "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
            "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
            "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
            // IP address dotted notation octets
            // excludes loopback network 0.0.0.0
            // excludes reserved space >= 224.0.0.0
            // excludes network & broadcast addresses
            // (first & last IP address of each class)
            "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
            "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
            "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
          "|" +
            // host & domain names, may end with dot
            // can be replaced by a shortest alternative
            // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
            "(?:" +
              "(?:" +
                "[a-z0-9\\u00a1-\\uffff]" +
                "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
              ")?" +
              "[a-z0-9\\u00a1-\\uffff]\\." +
            ")+" +
            // TLD identifier name, may end with dot
            "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)" +
          ")" +
          // port number (optional)
          "(?::\\d{2,5})?" +
          // resource path (optional)
          "(?:[/?#]\\S*)?" +
        "$", "i"
      );

    self.linkifyURLs = (text)=>{
        let out = [];
        let word = [];
        let start = 0, cur = 0;
        for(let char of text){
            // Note: unlike with 'of', text[n] would get only half of a wide unicode character
            if(char.match(/^\s$/)){
                if(start < cur){
                    flushWord();
                }
                start = cur + 1;
                out.push(char);
            }else{
                word.push(char);
            }
            cur++;
        }
        flushWord();
        return out.join('');

        function flushWord(){
            if(0 < word.length){
                let wordStr = word.join('');
                let unescaped = self.unescapeHTML(wordStr);
                word.length = 0;
                if(unescaped.match(URLRegex)){
                    out.push(`\u200B<a href="${unescaped}" class="userlink" target="_blank">${wordStr}</a>\u200B`);
                }else{
                    out.push(wordStr);
                }
            }
        }
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
    };

    self.escapeHTML = (text)=>{
        return text.replace(/([<>"&])/g, (a,b)=>{
            switch(b){
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "&": return "&amp;";
            default: return a;
            }
        });
    };

    self.escapeRegex = (text)=>{
        return text.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };

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

    self.replaceEmote = (text)=>{
        var emote = client.emotes[":"+text.toLowerCase()+":"];
        return (emote)? emote : text;
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
                    if(client.emotes[emote.toLowerCase()]){
                        out = out+client.emotes[emote.toLowerCase()];
                        // Scan ahead for next possible end point after "skipping" the emote.
                        end++;
                        start = end;
                        while(text[end+1] != ':' && end<text.length) end++;
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
        return self.replaceEmotes(self.markSelf(self.linkifyURLs(self.escapeHTML(text))));
    };

    self.updateTitle = ()=>{
        if(self.channel && client.servername){
            var unread = 0;
            for(let channel in client.channels)
                unread += client.channels[channel]["unread"];
            document.title = ((unread<=0)?"":"("+unread+") ")+self.channel+" | "+client.servername;
        }
    };
    
    self.notify = (update)=>{
        var settings = self.channelSettings[update.channel];
        if(settings && (settings["notify"] == "never"
                        || (settings["notify"] == "mention"
                            && (!update.text || update.text.search(client.username) == -1))))
            return false;
        if(cl.find("sound", self.notifyBy) && self.notifySound){
            self.notifySound.play();
        }
        if(cl.find("desktop", self.notifyBy) && window.Notification && Notification.permission === "granted"){
            if(cl.typep(update, "TEXT-UPDATE")){
                new Notification(title, {
                    body: update.from+": "+update.text,
                    icon: self.icon,
                    tag: "lichat"
                });
            }else if(cl.typep(update, "DATA") && cl.find(update["content-type"], ["image/gif", "image/jpeg", "image/png", "image/svg+xml"])){
                new Notification(title, {
                    image: "data:"+update["content-type"]+";base64,"+update["payload"],
                    icon: self.icon,
                    tag: "lichat"
                });
            }
        }
        return true;
    };

    self.requestNotifyPermissions = ()=>{
        if(Notification.permission === "granted"){
            return true;
        }else if(Notification.permission === "denied"){
            return false;
        }else{
            Notification.requestPermission((p)=>{});
            return null;
        }
    };

    var emotePopup = null;
    var emoteList = (()=>{
        let tabHandlers = {click: (ev)=>{
            emotePopup.querySelector(ev.target.dataset.tab).scrollIntoView();
        }};
        let list = {
            tag: "div",
            classes: ["emote-list"],
            elements: [
                {tag: "nav", classes: ["tablist"], elements: [
                    {tag: "i",
                     classes: ["fa", "fa-picture-o"], 
                     title: "Emoticons", 
                     dataset: {tab: ".emoticons"}, 
                     handlers: tabHandlers},
                    {tag: "i",
                     classes: ["fa", "fa-smile-o"], 
                     title: "Emoji", 
                     dataset: {tab: ".emoji"},
                     handlers: tabHandlers}
                ]},
                {tag: "div", classes: ["tabstack"], elements: [
                    {tag: "div", classes: ["emoticons"], style: {display: "none"}, elements: []},
                    {tag: "div", classes: ["emoji"], style: {display: "none"}, elements: []}
                ]}
            ]
        };
        let add = (tab, name, display) => {
            display = display || name;
            list.elements[1].elements[tab].elements.push({
                tag: "a",
                html: display,
                handlers: {click: ()=>{
                    emotePopup.cb(name);
                    document.body.removeChild(emotePopup);
                }}
            });
        };

        for(let emote in client.emotes){
            add(0, emote.substring(1,emote.length-1), client.emotes[emote]);
        }
        for(let emoji of allEmojis){
            if(emoji.length == 1) // Multiple codepoint emojis seem to fail for some reason.
                add(1, emoji.map(twemoji.convert.fromCodePoint).join());
        }
        let el = self.constructElement("div",list);
        twemoji.parse(el);
        return el;
    })();

    self.showEmoteList = (cb)=>{
        emotePopup = self.popup(emoteList);
        emotePopup.cb = cb;
        return emotePopup;
    };

    document.addEventListener("visibilitychange", ()=>{
        if(document.visibilityState === 'visible' && self.channel){
            self.updateUnreadCount(self.channel, "clear");
        }
    });

    client.addHandler("MESSAGE", (update)=>{
        update.html = self.formatUserText(update.text);
        self.showMessage(update);
    });

    client.addHandler("EDIT", (update)=>{
        update.html = self.formatUserText(update.text);
        self.editMessage(update);
    });

    client.addHandler("REACT", (update)=>{
        let msg = self.findMessage(update.channel, update.target, update["update-id"]);
        let channel = self.channelElement(update.channel);
        let shouldScroll = self.isAtBottom(channel);
        let list = msg.querySelector(".reactions");
        let el = Array.from(list.childNodes).find(el => el.dataset.emote === update.emote);
        
        if(!el){
            el = self.constructElement("li", {
                dataset: {"emote": update.emote},
                classes: ["reaction"],
                elements: [
                    {tag: "span", classes: ["emote"], html: self.replaceEmote(update.emote)},
                    {tag: "span", classes: ["count"], text: 0},
                    {tag: "ul", classes: ["users"]}
                ]
            });
            twemoji.parse(el);
            el.addEventListener("click", ()=>{
                var s = {channel: update.channel, target: update.target, emote: update.emote};
                s["update-id"] = update["update-id"];
                client.s("REACT", s);
            });
            list.appendChild(el);
            if(shouldScroll) self.scrollToBottom(channel);
        }
        let users = el.querySelector(".users");
        let entry = Array.from(users.childNodes).find(el => el.innerText == update.from);
        if(entry){
            users.removeChild(entry);
        }else{
            users.appendChild(self.constructElement("li", {text: update.from}));
        }
        el.querySelector(".count").innerText = ""+users.childNodes.length;
        if(users.childNodes.length == 0){
            list.removeChild(el);
        }
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

    client.addHandler("KICK", (update)=>{
        update.text = " ** kicked "+update.target;
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

    client.addHandler("SET-CHANNEL-INFO", (update)=>{
        if(self.channel == update.channel.toLowerCase() && update.key == cl.kw("TOPIC") && topic){
            topic.innerHTML = self.replaceEmotes(self.linkifyURLs(self.escapeHTML(update.text)));
        }
    });

    client.addHandler("PAUSE", (update)=>{
        if(update.by <= 0)
            update.text = " ** Paused mode has been deactivated. You can now chat freely.";
        else
            update.text = " ** Paused mode has been activated. You may only message every "+update.by+" seconds.";
        self.showMessage(update);
    });

    client.addHandler("QUIET", (update)=>{
        update.text = " ** "+update.target+" has been quieted. Their messages will no longer be visible.";
        self.showMessage(udpate);
    });

    client.addHandler("UNQUIET", (update)=>{
        update.text = " ** "+update.target+" has been unquieted. Their messages will be visible again.";
        self.showMessage(udpate);
    });

    client.addHandler("FAILURE", (update)=>{
        self.showMessage(update);
    });

    client.addHandler("CAPABILITIES", (update)=>{
        update.text = " ** You can perform the following here: "+update.updates.map((s)=>s.name).join(", ");
        self.showMessage(update);
    });

    client.addHandler("DENY", (update)=>{
        update.text = " ** "+update.target+" has been denied from "+update.update.name+"ing.";
        self.showMessage(update);
    });

    client.addHandler("GRANT", (update)=>{
        update.text = " ** "+update.target+" has been allowed to "+update.update.name+".";
        self.showMessage(update);
    });

    client.addHandler("SET-USER-INFO", (update)=>{
        update.text = " ** "+update.key+" has been updated.";
        self.showMessage(update);
    });

    client.addHandler("UPDATE", (update)=>{
        // Some events are uninteresting, so they should be ignored entirely.
        if(!cl.find(cl.classOf(update).className,
                    ["PING", "PONG", "EMOTES", "EMOTE", "USER-INFO", "SERVER-INFO"])){
            if(!update.text) update.text = "Received update of type "+update.type;
            self.showMessage(update);
        }
    });

    self.addCommand("help", ()=>{
        var text = "Available commands:";
        for(var name in self.commands){
            text += "<br/><label class='command'>"+self.commandPrefix+name+"</label>"
                + (self.commands[name].documentation || "");
        }
        self.showMessage({html: text});
    }, "Show all available commands");

    self.addCommand("register", (...args)=>{
        password = args.join(" ");
        if(password.length<6)
            cl.error("PASSWORD-TOO-SHORT",{text: "Your password must be at least six characters long."});
        client.s("REGISTER", {password: password});
    }, "Register your username with a password.");

    self.addCommand("create", (...args)=>{
        name = args.join(" ");
        if(!name) name = null;
        client.s("CREATE", {channel: name});
    }, "Create a new channel. Not specifying a name will create an anonymous channel.");

    self.addCommand("join", (...args)=>{
        name = args.join(" ");
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of the channel to join."});
        if(self.channelExists(name)){
            self.changeChannel(name);
        }else{
            client.s("JOIN", {channel: name});
        }
    }, "Join an existing channel.");

    self.addCommand("leave", (...args)=>{
        name = args.join(" ");
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

    self.addCommand("kickban", (user, name)=>{
        if(!user) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to kick."});
        if(!name) name = self.channel;
        client.s("DENY", {channel: name, target: user, update: cl.li("JOIN")});
        client.s("KICK", {channel: name, target: user});
    }, "Kick and ban a user from a channel. Not specifying a name will leave the current channel.");
    
    self.addCommand("users", (...args)=>{
        name = args.join(" ");
        if(!name) name = self.channel;
        client.s("USERS", {channel:name});
    }, "Fetch a list of users from a channel. Not specifying a name will leave the current channel.");

    self.addCommand("channels", ()=>{
        client.s("CHANNELS", {});
    }, "Fetch a list of public channels.");

    self.addCommand("info", (...args)=>{
        var target = args.join(" ");
        if(!target) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a user to query."});
        var el = self.popup({tag:"div", classes: ["info"]}).querySelector("div.info");
        var showField = (field, parent)=>{
            parent.appendChild(self.constructElement("div", {
                classes: ["row"],
                elements: [
                    {tag: "label", text: ""+field[0]},
                    {tag: "span", text: ""+field[1]}
                ]
            }));
        };
        client.s("USER-INFO", {target: target}, (u)=>{
            if(cl.typep(u, "USER-INFO")){
                for(var field of u.fields){
                    if(field != "id" && field != "clock" && field != "from" && field != "target" && field != "info"){
                        showField([field, u[field]], el);
                    }
                }
                if(u.info === undefined) return;
                // Augment with default fields
                var info = u.info;
                for(var name of ["ICON", "BIRTHDAY", "CONTACT", "LOCATION", "PUBLIC-KEY", "REAL-NAME", "STATUS"]){
                    var symbol = cl.kw(name);
                    var found = false;
                    for(var field of info){
                        if(field[0] == symbol) found = true;
                    }
                    if(!found) info.push([cl.kw(name), ""]);
                }
                // Actually show the fields.
                for(var field of info){
                    if(field[0].name == "ICON"){
                        var parts = field[1].split(" ");
                        var image = self.constructElement("div", {
                            classes: ["row"],
                            elements: [
                                {tag: "label", text: "Icon"},
                                {tag: "img", classes: ["icon"], attributes: {src: "data:"+parts[0]+";base64,"+parts[1]}}
                            ]
                        });
                        el.appendChild(image);
                        if(target == client.username){
                            el.addEventListener("click", ()=>self.promptIcon((icon)=>{
                                client.s("SET-USER-INFO", {key: LichatReader.fromString(":ICON"), text: icon});
                            }));
                        }
                    }else{
                        showField([(""+field[0]).toLowerCase(), field[1]], el);
                    }
                }
            }else{
                el.appendChild = "Failed to fetch user info.";
            }
        });
        client.s("SERVER-INFO", {target: target}, (u)=>{
            if(cl.typep(u, "SERVER-INFO")){
                for(field of u.attributes) showField(field, el);
                el.appendChild(self.constructElement("div", {
                    classes: ["row"],
                    elements: [
                        {tag: "label", text: "Connections"},
                        {tag: "div", classes: ["connections"]}
                    ]
                }));
                for(var connection of u.connections){
                    var conn = self.constructElement("div", {classes: ["connection"]});
                    el.querySelector(".connections").appendChild(conn);
                    for(field of connection) showField(field, conn);
                }
            }
        });
    }, "Fetch information about a user.");

    self.addCommand("message", (name, ...args)=>{
        if(!name) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of a channel to message to."});;
        client.s("MESSAGE", {channel:name, text:args.join(" ")});
    }, "Send a message to a channel. Note that you must be in the channel to send to it.");

    self.addCommand("me", (...text)=>{
        client.s("MESSAGE", {channel:self.channel, text: "*"+text.join(" ")+"*"});
    });

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

    self.addCommand("topic", (...args)=>{
        text = args.join(" ");
        client.s("SET-CHANNEL-INFO", {channel: self.channel, key: cl.kw("TOPIC"), text: text});
    }, "Update the channel topic.");

    self.addCommand("pause", (seconds)=>{
        client.s("PAUSE", {channel: self.channel, by: parseInt(seconds)});
    }, "Change the channel's pause mode.");

    self.addCommand("quiet", (...args)=>{
        client.s("QUIET", {channel: self.channel, target: args.join(" ")});
    }, "Quiet another user in the current channel.");

    self.addCommand("unquiet", (...args)=>{
        client.s("UNQUIET", {channel: self.channel, target: args.join(" ")});
    }, "Unquiet another user in the current channel.");

    self.addCommand("kill", (...args)=>{
        client.s("KILL", {target: args.join(" ")});
    }, "Kill a user from the server.");

    self.addCommand("destroy", (...args)=>{
        client.s("DESTROY", {channel: args.join(" ")});
    }, "Destroy a channel from the server.");

    self.addCommand("ban", (...args)=>{
        client.s("BAN", {target: args.join(" ")});
    }, "Ban a username from the server.");

    self.addCommand("unban", (...args)=>{
        client.s("UNBAN", {target: args.join(" ")});
    }, "Unban a username from the server.");

    self.addCommand("ip-ban", (ip, mask)=>{
        client.s("IP-BAN", {ip: ip, mask: mask});
    }, "Ban an IP address from the server.");

    self.addCommand("ip-unban", (ip, mask)=>{
        client.s("IP-UNBAN", {ip: ip, mask: mask});
    }, "Unban an IP address from the server.");

    self.addCommand("capabilities", ()=>{
        client.s("CAPABILITIES", {channel: self.channel});
    }, "Request information on which capabilities you have in the current channel.");

    self.addCommand("grant", (update, ...target)=>{
        client.s("GRANT", {channel: self.channel, target: target.join(" "), update: cl.findSymbol(update, "LICHAT-PROTOCOL")});
    }, "Grant permission for an update to another user.");

    self.addCommand("deny", (update, ...target)=>{
        client.s("DENY", {channel: self.channel, target: target.join(" "), update: cl.findSymbol(update, "LICHAT-PROTOCOL")});
    }, "Deny permission for an update to another user.");

    self.addCommand("server-info", (...args)=>{
        client.s("SERVER-INFO", {target: args.join(" ")});
    }, "Request server information on another user.");

    self.addCommand("set", (key, ...text)=>{
        client.s("SET-USER-INFO", {key: LichatReader.fromString(key), text: text.join(" ")});
    }, "Set user information. By default the following keys are available: :birthday :contact :location :public-key :real-name :status");

    self.addCommand("away", ()=>{
        client.s("SET-USER-INFO", {key: cl.kw("STATUS"), text: "away"});
    }, "Set yourself as being away. You can return by using /status");

    self.addCommand("status", (...text)=>{
        client.s("SET-USER-INFO", {key: cl.kw("STATUS"), text: text.join(" ")});
    }, "Set your status to a new value.");

    self.addCommand("ignore", (...user)=>{
        var name = user.join(" ");
        var settings = self.userSettings[name] || {};
        settings["ignore"] = !settings["ignore"];
        self.userSettings[name] = settings;
        self.rebuildUserStyles();
        self.showMessage({text: (settings["ignore"]?"ignored":"unignored")+" "+name+"."});
    }, "Ignore or unignore a user's messages.");

    self.addCommand("block", (...user)=>{
        client.s("BLOCK", {target: user.join(" ")});
    }, "Block a user's messages from reaching you.");

    self.addCommand("unblock", (...user)=>{
        client.s("UNBLOCK", {target: user.join(" ")});
    }, "Unblock a user and receive their messages again.");

    self.addCommand("send-as", (user, ...text)=>{
        client.s("MESSAGE", {bridge: user, channel: self.channel, text: text.join(" ")});
    }, "Send a message assuming the name of another in the current channel. Requires BRIDGE permission.");

    self.initControls = ()=>{
        chat.addEventListener("drop", (ev)=>{
            ev.preventDefault();

            if(ev.dataTransfer.items){
                for(var i=0; i<ev.dataTransfer.items.length; i++){
                    if (ev.dataTransfer.items[i].kind === 'file') {
                        self.sendFile(ev.dataTransfer.items[i].getAsFile());
                    }
                }
            }else{
                for(var i=0; i<ev.dataTransfer.files.length; i++){
                    self.sendFile(ev.dataTransfer.files[i]);
                }
            }
        });
        chat.addEventListener("dragover", (ev)=>{
            ev.preventDefault();
        });
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
            return true;
        });
    };

    self.initControls();
    self.load();
    self.rebuildUserStyles();

    return self;
};

// TODO: Show message history
// TODO: Channel permissions editor
// TODO: Allow picking notification sounds
// TODO: Show icons for users and channels in list
// TODO: Unify info display between channels and users, and allow setting your own
//       if requesting the user info of yourself.
// TODO: Show away/status in user list
//       Need to figure out how status updates should be broadcast first.
// TODO: Check channel capabilities and trim context menu
//       Should we even do this? Is it worse to show unusable actions than
//       it is to possibly be out of date because we miss permission changes?
