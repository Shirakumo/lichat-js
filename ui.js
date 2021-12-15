class LichatUI{
    constructor(el){
        this.commands = {};
        this.clients = {};
        this.currentChannel = null;
        this.app = new Vue({
            el: el || '.client',
            data: this,
            methods: {
                submit: (ev)=>{
                    let message = this.currentChannel.currentMessage;
                    if(!ev.getModifierState("Control") && !ev.getModifierState("Shift")){
                        let channel = this.currentChannel;
                        message.text = message.text.trimEnd();
                        if(message.text.startsWith("/")){
                            this.processCommand(message.text, channel);
                        }else{
                            channel.s("MESSAGE", {
                                "text": message.text,
                                "reply-to": (message.replyTo)? [message.replyTo.author.name, message.replyTo.id]: null
                            }).catch((e)=>{
                                channel.showStatus("Error: "+e.text);
                            });
                        }
                        message.clear();
                    }
                }
            }
        });

        this.addClient(new LichatClient({
            name: "TyNET",
            hostname: "chat.tymoon.eu",
            ssl: true
        }));

        this.addCommand("help", (channel, subcommand)=>{
            if(subcommand){
                let command = this.commands["/"+subcommand];
                if(command){
                    let arglist = (command.handler + '')
                        .replace(/[/][/].*$/mg,'') // strip single-line comments
                        .replace(/\s+/g, '') // strip white space
                        .replace(/[/][*][^/*]*[*][/]/g, '') // strip multi-line comments  
                        .split('){', 1)[0].replace(/^[^(]*[(]/, '') // extract the parameters  
                        .replace(/=[^,]+/g, '').replace(')', '')
                        .split(',').filter(Boolean).slice(1); // split & filter [""]
                    channel.showStatus("/"+subcommand+" "+arglist.join(" ")+"\n\n"+command.help);
                }else{
                    channel.showStatus("No command named "+subcommand);
                }
            }else{
                let text = "<table><thead><tr><th>Command</th><th>Help</th></tr></thead><tbody>";
                for(let name in this.commands){
                    text += "<tr><td>"+name
                        +"</td><td>"+this.commands[name].help
                        +"</td></tr>";
                }
                text += "</tbody></table>";
                channel.showStatus(text, {html: true});
            }
        }, "Show help information on the available commands.");

        this.addCommand("join", (channel, ...name)=>{
            name = name.join(" ");
            channel.client.s("JOIN", {channel: name})
                .then(()=>{this.currentChannel = channel.client.getChannel(name);});
        }, "Join a new channel.");

        this.addCommand("leave", (channel, ...name)=>{
            name = (0 < name.length)? name.join(" ") : channel.name;
            channel.client.s("LEAVE", {channel: name})
                .then(()=>{
                    let deleted = channel.client.deleteChannel(name);
                    if(deleted == this.currentChannel){
                        this.currentChannel = null;
                    }
                });
        }, "Leave a channel. If no channel is specified, leaves the current channel");
    }

    addClient(client){
        Vue.set(this.clients, client.name, client);
        client.openConnection();
        return client;
    }

    addCommand(command, fun, help){
        this.commands["/"+command] = {
            handler: fun,
            help: help
        };
    }

    processCommand(cmdname, channel){
        try{
            let args = cmdname.split(" ");
            let command = this.commands[args[0]];
            if(!command) throw "No command named "+args[0];
            args[0] = channel;
            command.handler.apply(this, args);
        }catch(e){
            console.log(e);
            channel.showStatus("Error: "+e);
        }
    }
}
