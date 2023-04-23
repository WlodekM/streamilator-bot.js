import WebSocket from "ws";
import fetch from "node-fetch";
import EventEmitter from "events";

export default class Bot extends EventEmitter {
    /**
    * Connects to the (specified) server, then logs in
    * @param {string} username The bot's username
    * @param {string} password The bot's password
    * @param {string} server The server to connect to, default is `wss://server.meower.org/`
    * @param {string} prefix The bot's prefix, default is a `@` mention of the bot's username
    * @returns {void}
    */
    login(username, password, server="wss://server.streamilator.tk/", prefix=`@${username}`) {
        this.username = username;
        this.password = password;
        this.prefix = prefix;
        this.ws = new WebSocket(server);

        this.ws.on("open", async () => {
            this.send({
                "cmd": "direct",
                "val": {
                    "cmd": "type",
                    "val": "js"
                }
            });

            this.send({
                "cmd": "direct",
                "val": {
                    "cmd": "ip",
                    "val": await fetch("https://api.streamilator.tk/ip").then(res => res.text())
                }
            });

            this.send({
                "cmd": "direct",
                "val": "meower"
            });

            this.send({
                "cmd": "direct",
                "val": {
                    "cmd": "authpswd",
                    "val": {
                        "username": username,
                        "pswd": password
                    }
                }
            });
            
            setInterval(() => {
                if (this.ws.readyState == 1) {
                    this.send({
                        "cmd": "ping",
                        "val": ""
                    });
                }
            }, 10000);
            
            setTimeout(() => {
                this.emit("login");
            }, 1000);

            this.ws.on("close", () => {
                this.emit("close");
            });

            this.ws.on("message", (data) => {
                this.emit("message", data);
            });

            this.ws.on("message", (data) => {
                let messageData = JSON.parse(data);
                if (messageData.val.type === 1) {
                    try {
                        if (messageData.val.u === this.username) {
                            return;
                        } else if (messageData.val.u == "Discord" || messageData.val.u == "Revower" || messageData.val.u == "revolt" || messageData.val.u == "irc2meower") {
                            this.emit("post", messageData.val.p.split(": ")[0], messageData.val.p.split(": ")[1], (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                        } else {
                            this.emit("post", messageData.val.u, messageData.val.p, (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                        }
                    } catch(e) {
                        console.error(e);
                    }
                } else if (messageData.cmd === "pmsg") {
                    this.send({
                        "cmd": "pmsg",
                        "val": "I: 100 | Bot",
                        "id": messageData.origin
                    });
                }
            });
        });
    }

    /**
    * Post to home, or a group chat, if specified
    * @param {string} content The post content
    * @param {string} id The group chat ID to post to, leave empty to post to home
    * @returns {void}
    */
    post(content, id=null) {
        if (id) {
            this.send({
                "cmd": "direct",
                "val": {
                    "cmd": "post_chat",
                    "val": {
                        "p": content,
                        "chatid": id
                    }
                }
            });
        } else {
            this.send({
                "cmd": "direct",
                "val": {
                    "cmd": "post_home",
                    "val": content
                }
            });
        }
    }

    /**
    * Executes the callback when a new post is sent
    * @param {Function} callback The callback to use
    * @returns {void}
    */
    onPost(callback) {
        this.on("post", (username, content, origin) => {
            callback(username, content, origin);
        });
    }

    /**
    * Executes the callback when the connection is closed
    * @param {Function} callback The callback to use
    * @returns {void}
    */
    onClose(callback) {
        this.on("close", () => {
            callback();
        });
    }


    /**
    * Executes the callback when a new message from the server is sent
    * @param {Function} callback The callback to use
    * @returns {void}
    */
    onMessage(callback) {
        this.on("message", (data) => {
            callback(data);
        });
    }


    /**
    * Executes the callback when successfully logged in
    * @param {Function} callback The callback to use
    * @returns {void}
    */
    onLogin(callback) {
        this.on("login", () => {
            callback();
        });
    }

    /**
    * Executes the callback when a bot command is sent
    * @param {string} command The command to wait for
    * @param {Function} callback The callback to use
    */
    onCommand(command, callback) {
        this.on("message", (data) => {
            let messageData = JSON.parse(data);
            try {
                if (messageData.val.type === 1) {
                    if (messageData.val.u === this.username) {
                        return;
                    } else if (messageData.val.u == "Discord" || messageData.val.u == "Revower" || messageData.val.u == "revolt" || messageData.val.u == "revolt" || messageData.val.u == "irc2meower") {
                        if (messageData.val.p.startsWith(`${this.prefix} ${command}`)) {
                            callback({
                                user: messageData.val.p.split(": ")[0],
                                args: messageData.val.p.split(": ")[1].split(" ").splice(0, 1),
                                origin: (messageData.val.post_origin == "home" ? null : messageData.val.post_origin),
                                reply: (content) => {
                                    this.post(`@${this.user} ${origin}`, (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                                },
                                post: (content) => {
                                    this.post(content, (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                                }
                            });
                        }
                    } else {
                        if (messageData.val.p.startsWith(`${this.prefix} ${command}`)) {
                            callback({
                                user: messageData.val.u,
                                args: messageData.val.p.split(" ").splice(0, 1),
                                reply: (content) => {
                                    this.post(`@${messageData.val.u} ${content}`, (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                                },
                                post: (content) => {
                                    this.post(content, (messageData.val.post_origin == "home" ? null : messageData.val.post_origin));
                                }
                            });
                        }
                    }
                }
            } catch(e) {
                console.error(e);
            }
        });
    }

    /**
    * Sends a message to the server
    * @param {object} message The message to send
    * @returns {void}
    */
    send(message) {
        this.ws.send(JSON.stringify(message));
    }
    
    /**
    * Closes the connection to the currently connected server
    * @returns {void}
    */
    close() {
        this.ws.close();
    }
}

export class API {
    /**
    * @param {string} url The URL of the API to use
    */
    constructor(url="https://api.streamilator.tk/") {
        this.url = url;
    }

    /**
    * Gets the specified page in home
    * @param {number} page The page to get
    * @returns {Promise<object[]>}
    */
    async getHome(page=1) {
        const home = await fetch(`${this.url}home?autoget&page=${page}`).then(res => res.json()).catch(e => {
            throw e;
        });
        return home.autoget;
    }

    /**
    * Gets the specified user
    * @param {string} user The page to get
    * @returns {Promise<object>}
    */
    async getUser(user) {
        const user_obj = await fetch(`${this.url}users/${user}`).then(res => res.json()).catch(e => {
            throw e;
        });
        return user_obj;
    }
}
