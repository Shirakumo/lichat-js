var login = document.querySelector(".login");
var stat = document.querySelector(".status");
var chat = document.querySelector(".chat");
var menu = document.querySelector(".menu");
var about = document.querySelector(".about");
var settings = document.querySelector(".settings");
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

var urlParams = (url)=>{
    if(!url) url = window.location.href;
    var params = {};
    for(var i=(url.indexOf("?")||url.length)+1; i<url.length; i++){
        var j=i;
        key:
        for(;; i++){
            if(url[i] == '&' || url[i] == undefined){
                params[decodeURIComponent(url.slice(j, i))] = null;
                break key;
            }
            if(url[i] == '='){
                var key = decodeURIComponent(url.slice(j, i));
                i++; j=i;
                for(;; i++){
                    if(url[i] == '&' || url[i] == undefined){
                        params[key] = decodeURIComponent(url.slice(j, i));
                        break key;
                    }
                }
            }
        }
    }
    return params;
};

var changeTheme = (theme)=>{
    if(!login.querySelector("select[name=theme] option[value="+theme+"]")){
        var themes = Array.from(login.querySelectorAll("select[name=theme] option")).map((n)=>n.value).join(", ");
        cl.error("NO-SUCH-THEME",{text: "The theme name you supplied is unknown. Should be one of: "+themes});
    }
    
    login.querySelector("select[name=theme]").value = theme;
    document.querySelector("body").setAttribute("class", theme);
    save("theme", theme);
    return theme;
};

var ssl = (window.location.protocol === "https:" || window.location.protocol === "https");
var defaultPort = (ssl)?"1114":"1113";
var setup = ()=>{
    var params = urlParams();
    if(params.hide !== undefined){
        if(params.username) login.querySelector("input[name=username]").parentNode.style.display = "none";
        if(params.password) login.querySelector("input[name=password]").parentNode.style.display = "none";
        if(params.hostname) login.querySelector("input[name=hostname]").parentNode.style.display = "none";
        if(params.port) login.querySelector("input[name=port]").parentNode.style.display = "none";
        if(params.channel) login.querySelector("input[name=channel]").parentNode.style.display = "none";
        if(params.theme) login.querySelector("select[name=theme]").parentNode.style.display = "none";
    }
    login.querySelector("input[name=username]").value = params.username || load("username", login.querySelector("input[name=username]").value);
    login.querySelector("input[name=password]").value = params.password || load("password", login.querySelector("input[name=password]").value);
    login.querySelector("input[name=hostname]").value = params.hostname || load("hostname", login.querySelector("input[name=hostname]").value);
    login.querySelector("input[name=port]").value =     params.port     || load("port", defaultPort);
    login.querySelector("input[name=channel]").value =  params.channel  || load("channel", login.querySelector("input[name=channel]").value);
    ui.notifyBy = load("notifyBy", []);
    ui.notifySound.volume = load("volume", 0.5);
    for(var value of ui.notifyBy){
        settings.querySelector("[name=notifyBy][value="+value+"]").checked = true;
    }
    settings.querySelector("[name=volume]").value = ""+ui.notifySound.volume;
    changeTheme(params.theme || load("theme", "light"));
};

var addEmoteToUI = (name)=>{
    var el = document.createElement("a");
    el.innerHTML = client.emotes[name];
    el = el.firstChild;
    el.addEventListener("click", (ev)=>{
        chat.querySelector(".lichat-input").value += name;
        chat.querySelector(".lichat-input").focus();
        chat.querySelector("#emotes").click();
    });
    chat.querySelector(".emote-list").appendChild(el);
};

for(var emote in client.emotes) addEmoteToUI(emote);

login.querySelector("[name=theme]").addEventListener("change", (ev)=>{
    changeTheme(ev.target.value);
});

about.querySelector("button").addEventListener("click", (ev)=>{
    about.style.display = "none";
});

settings.querySelector("button").addEventListener("click", (ev)=>{
    if(settings.querySelector("[name=notifyBy][value=desktop]").checked){
        ui.requestNotifyPermissions();
    }
    ui.notifyBy = Array.from(settings.querySelectorAll("[name=notifyBy]")).filter((e)=>e.checked).map((e)=>e.value);
    ui.notifySound.volume = parseFloat(settings.querySelector("[name=volume]").value);
    save("notifyBy", ui.notifyBy);
    save("volume", ui.notifySound.volume);
    settings.style.display = "none";
});

client.handleFailure = (e)=>{
    if(console)
        console.log("Failure:",e);
    if(e instanceof Condition){
        if(e.update && (e.update.type == "INVALID-PASSWORD" || e.update.type == "NO-SUCH-PROFILE")){
            var pwfield = login.querySelector("input[name=password]");
            if(pwfield){
                pwfield.parentNode.setAttribute("style","");
                pwfield.focus();
            }
        }
        fail(e.text || e.type);
    }else{
        fail(e+"");
    }
};

client.addHandler("DISCONNECT", (update)=>{
    fail("Disconnected");
});

client.addHandler("CONNECT", (update)=>{
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

client.addHandler("EMOTE", (update)=>{
    addEmoteToUI(":"+update["name"].toLowerCase().replace(/^:|:$/g,"")+":");
});

login.addEventListener("submit", (ev)=>{
    ev.preventDefault();
    login.style.display = "none";
    client.username = login.querySelector("input[name=username]").value;
    client.password = login.querySelector("input[name=password]").value;
    client.hostname = login.querySelector("input[name=hostname]").value;
    client.port = parseInt(login.querySelector("input[name=port]").value);
    client.ssl = (client.port === 1114);
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

chat.querySelector("#emotes").addEventListener("click", (ev)=>{
    chat.querySelector(".emote-list").style.display =
        (chat.querySelector(".emote-list").style.display != "block") ? "block" : "none";
}, false);

chat.querySelector("[type=file]").addEventListener("change", (ev)=>{
    ui.sendFile(chat.querySelector("[type=file]").files[0]);
    chat.querySelector("[type=file]").value = null;
    chat.querySelector(".lichat-input").focus();
    ev.preventDefault();
}, false);

menu.querySelector("[data-action=create]").addEventListener("click", (ev)=>{
    var name = prompt("Please enter a channel name, or leave it empty for an anonymous channel:");
    if(typeof name === 'string' || name instanceof String)
        ui.invokeCommand("create", name);
}, false);

menu.querySelector("[data-action=join]").addEventListener("click", (ev)=>{
    var name = prompt("Please enter a channel name:");
    if(name) ui.invokeCommand("join", name);
}, false);

menu.querySelector("[data-action=leave]").addEventListener("click", (ev)=>{
    if(name) ui.invokeCommand("leave");
}, false);

menu.querySelector("[data-action=users]").addEventListener("click", (ev)=>{
    var userlist = chat.querySelector(".users");
    userlist.style.setProperty("display", (window.getComputedStyle(userlist).display == "none")? "flex" : "none", "important");
}, false);

menu.querySelector("[data-action=channels]").addEventListener("click", (ev)=>{
    var channellist = chat.querySelector(".channels");
    channellist.style.setProperty("display", (window.getComputedStyle(channellist).display == "none")? "flex" : "none", "important");
}, false);

menu.querySelector("[data-action=about]").addEventListener("click", (ev)=>{
    about.style.display = "block";
}, false);

menu.querySelector("[data-action=settings]").addEventListener("click", (ev)=>{
    settings.style.display = "flex";
}, false);

ui.addCommand("theme", (theme)=>{
    if(!theme) cl.error("MISSING-ARGUMENT",{text: "You must supply the name of the theme to use."});
    changeTheme(theme);
}, "Change the theme. Available: light, dark");

setup();
