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
                        message.text = message.text.trimEnd();
                        if(message.text.startsWith("/")){
                            this.processCommand(message.text, this.currentChannel);
                        }else{
                            this.currentChannel.s("MESSAGE", {
                                "text": message.text,
                                "reply-to": (message.replyTo)? [message.replyTo.author.name, message.replyTo.id]: null
                            }, true);
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
                channel.showStatus(text, true);
            }
        }, "Show help information on the available commands.");
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
