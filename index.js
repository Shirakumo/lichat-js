var login = document.querySelector(".login");
var stat = document.querySelector(".status");
var chat = document.querySelector(".chat");
var menu = document.querySelector(".menu");
var client = new LichatClient();
var ui = new LichatUI(chat, client);

var fail = function(reason){
    chat.style.display = "none";
    stat.style.display = "block";
    login.style.display = "block";
    stat.innerHTML = reason;
    window.onbeforeunload = ()=>{
        return true;
    };
    ui.reset();
};

var save = (name, value)=>{
    if(window.localStorage){
        window.localStorage.setItem(name, JSON.stringify(value));
    }
    return value;
};

var load = (name, def)=>{
    if(window.localStorage){
        var value = window.localStorage.getItem(name);
        return (value)? JSON.parse(value) : def;
    }else{
        return def;
    }
};

var defaultPort = (window.location.protocol==="https:")?"1114":"1113";
var setup = ()=>{
    login.querySelector("input[name=username]").value = load("username", "Lion");
    login.querySelector("input[name=password]").value = load("password", "");
    login.querySelector("input[name=hostname]").value = load("hostname", "localhost");
    login.querySelector("input[name=port]").value = load("port", defaultPort);
    login.querySelector("input[name=channel]").value = load("channel", "");
    login.querySelector("select[name=theme]").value = load("theme", "light");
    document.querySelector("body").setAttribute("class", load("theme", "light"));
};

login.querySelector("[name=theme]").addEventListener("change", (ev)=>{
    document.querySelector("body").setAttribute("class", ev.target.value);
    save("theme", ev.target.value);
});

client.handleFailure = (e)=>{
    console.log("Failure:",e);
    fail(e+"");
};

client.addHandler("DISCONNECT", (client,update)=>{
    fail("Disconnected");
});

client.addHandler("CONNECT", (client,update)=>{
    stat.style.display = "none";
    chat.style.display = "";

    var channel = login.querySelector("input[name=channel]").value;
    if(channel){
        setTimeout(()=> ui.invokeCommand("join", channel), 500);
    }
    
    window.onbeforeunload = ()=>{
        return "Are you sure you want to leave?";
    };
});

login.addEventListener("submit", (ev)=>{
    ev.preventDefault()
    login.style.display = "none";
    client.username = login.querySelector("input[name=username]").value;
    client.password = login.querySelector("input[name=password]").value;
    client.hostname = login.querySelector("input[name=hostname]").value;
    client.port = parseInt(login.querySelector("input[name=port]").value);
    save("username", client.username);
    save("password", client.password);
    save("hostname", client.hostname);
    save("port", client.port);
    save("channel", login.querySelector("input[name=channel]").value);
    stat.style.display = "block";
    stat.innerHTML = "Connecting...";
    client.openConnection();
    return false;
}, false);

chat.querySelector("[type=submit]").addEventListener("click", (ev)=>{
    ui.processInput();
}, false);

chat.querySelector("[type=file]").addEventListener("change", (ev)=>{
    ui.sendFile(chat.querySelector("[type=file]").files[0]);
    chat.querySelector("[type=file]").value = null;
}, false);

menu.querySelector("[data-action=create]").addEventListener("click", (ev)=>{
    var name = prompt("Please enter a channel name:");
    if(name) ui.invokeCommand("create", name);
}, false);

menu.querySelector("[data-action=join]").addEventListener("click", (ev)=>{
    var name = prompt("Please enter a channel name:");
    if(name) ui.invokeCommand("join", name);
}, false);

menu.querySelector("[data-action=leave]").addEventListener("click", (ev)=>{
    if(name) ui.invokeCommand("leave");
}, false);

setup();
