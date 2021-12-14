class LichatUI{
    constructor(el){
        this.clients = {};
        this.currentChannel = null;
        this.app = new Vue({
            el: el || '.client',
            data: this
        });

        this.addClient(new LichatClient({
            name: "TyNET",
            hostname: "chat.tymoon.eu",
            ssl: true
        }));
    }

    addClient(client){
        Vue.set(this.clients, client.name, client);
        client.openConnection();
        return client;
    }
}
