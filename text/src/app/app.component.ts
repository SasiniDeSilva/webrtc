import { Component } from '@angular/core';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
 // title = 'webrtc';
  userList:string[] =[];
  private answeredUsers :string[]=[];
  private offeredUsers :string[]=[];

  messagedQueue: any[]=[];
  username: string;
  connectedUser;
  callToUsername: string;
  message: string;
  conn;
  localConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  sendDataChannel: RTCDataChannel;
  receiveDataChannel: RTCDataChannel;
  logged = false;
  chartarea = false;
  constructor() {
   
  }

  ngOnInit(){
    this.connectSignalServer();
  }


  public connectSignalServer() {
    //connecting to our signaling server 
    this.conn = new WebSocket('ws://localhost:9090');

    this.conn.onopen = function () {
      console.log("Connected to the signaling server");
    };

    //when we got a message from a signaling server 
    this.conn.onmessage = ((msg) => {
      console.log("Got message", msg.data);

      var data = JSON.parse(msg.data);

      switch (data.type) {
        case "login":
          this.handleLogin(data.success);
          break;
        //when somebody wants to call us 
        case "offer":
          this.handleOffer(data.offer, data.name);
          break;
        case "answer":
          this.handleAnswer(data.answer);
          this.answeredUsers.push(data.name);
          break;

        //when a remote peer sends an ice candidate to us 
        case "candidate":
          this.handleCandidate(data.candidate);
          break;

        //     case "leave": 
        //        handleLeave(); 
        //        break; 
        default:
          break;
      }
    }).bind(this);

    this.conn.onerror = function (err) {
      console.log("Got error", err);
    };
  }


  //alias for sending JSON encoded messages 
  public sendConnectionMessage(message) {

    //attach the other peer username to our messages 
    if (this.connectedUser) {
      message.name = this.connectedUser;
    }

    this.conn.send(JSON.stringify(message)); // triggering the signalling server on message
  }

  // login button click.
  public onLogin() {
    if (this.username != null) {
      this.sendConnectionMessage({
        type: "login",
        name: this.username
      });
    }
  }

  
  public CallToUser() {
    if (this.callToUsername != null) {
      this.connectedUser = this.callToUsername;
      // create an offer
      this.localConnection.createOffer().then(offer => {

        this.sendConnectionMessage({
          type: "offer", //type
          offer: offer //sdp -is used by WebRTC to negotiate the session’s parameters. Since there is no signaling in WebRTC (session description protocol)
        });

        this.localConnection.setLocalDescription(offer);
      }).catch(error => {
        alert("Error when creating an offer");
      });
    }

  }

  public SendMessage() {
    
    this.messagedQueue.push({"message":this.message, "user":this.username, "time":new Date()});
    this.dataChannel.send(this.message);
    this.chartarea = true;
  }
 
  public handleLogin(success) {
    if (success === false) {
      alert("Ooops...try a different username");
    } else {
      console.log("sucessfullylogged")
      this.logged = true;
      this.userList.push(this.username);
      this.createPeerConnection();
    }
  }

  public handleOffer(offer, name) {
    this.connectedUser = name;
    this.localConnection.setRemoteDescription(new RTCSessionDescription(offer));
    this.offeredUsers.push(name);

    //create an answer to an offer 
    this.localConnection.createAnswer().then(
      answer => {
        this.localConnection.setLocalDescription(answer);
        this.sendConnectionMessage({
          type: "answer",
          answer: answer
        });
     
      }
    ).catch(error => {
      alert("Error when creating an answer");
    });

  }

  //when we got an answer from a remote user 
  public handleAnswer(answer) {
    this.localConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  //when we got an ice candidate from a remote user 
  public handleCandidate(candidate) {
    this.localConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public  handleLeave() { 
    this.connectedUser = null; 
    this.localConnection.close(); 
    this.localConnection.onicecandidate = null; 
 }


//create peer Connection
  public createPeerConnection() {
    let configuration = { iceServers: [{ urls: 'stun:stun.example.org' }] };

    this.localConnection = new RTCPeerConnection(configuration);

    console.log('Created local peer connection object localConnection');

    this.localConnection.onicecandidate = ((event) => {
      if (event.candidate) {
        this.sendConnectionMessage({
          type: "candidate",
          candidate: event.candidate
        });
      }
    }).bind(this);

    this.localConnection.ondatachannel = ((event) => {
      this.receiveDataChannel = event.channel;
      
      this.receiveDataChannel.onmessage = event=>{
        this.messagedQueue.push({"message":event.data, "user":this.connectedUser, "time":new Date()});
        console.log(this.connectedUser + "is connected" +" Sent Message :"+ event.data);
      }

      this.receiveDataChannel.onopen = ((event) => {
        var readyState = this.dataChannel.readyState;
        console.log(readyState);
      }).bind(this);

    });

    this.openDataChannel();

    console.log("DataChannel opened");
  }
  
  //data channel
  public openDataChannel() {
    this.dataChannel = this.localConnection.createDataChannel("channel1");

    this.dataChannel.onerror = ((error) => {
      console.log("Ooops...error:", error);
    });

    this.dataChannel.onmessage = ((event) => {
      console.log(this.connectedUser + "is connected" +" Sent Message :"+ event.data);
    }).bind(this);

    this.dataChannel.onclose = (() => {
      console.log("data channel is closed");
    });

    this.dataChannel.onopen = ((event) => {
      var readyState = this.dataChannel.readyState;
      console.log(readyState);
    }).bind(this);

    // this.localConnection.ondatachannel = ((event) => {
    //   this.receiveDataChannel = event.channel;
    //   this.receiveDataChannel.onopen = handleDataChannelOpen;
    //   this.receiveDataChannel.onmessage = handleDataChannelMessageReceived;
    //   this.receiveDataChannel.onerror = handleDataChannelError;
    //   this.receiveDataChannel.onclose = handleDataChannelClose;

    // });

    // var handleDataChannelOpen = ((event)=>{
    //   var readyState = this.dataChannel.readyState;
    //     console.log(readyState);
    // }).bind(this);

    // const handleDataChannelMessageReceived  = ((event) => {
    //     console.log(this.connectedUser + "is connected" + event.data);
    //   }).bind(this);

    //   const handleDataChannelError = (error)=>{
    //     console.log("Ooops...error:", error);
    //   }

    //   const handleDataChannelClose = (event) =>{
    //     console.log("data channel is closed");
    //   }

    // this.sendDataChannel = this.localConnection.createDataChannel("channel1");

    // this.sendDataChannel.onopen = handleDataChannelOpen;
    // this.sendDataChannel.onmessage = handleDataChannelMessageReceived;
    // this.sendDataChannel.onerror = handleDataChannelError;
    // this.sendDataChannel.onclose = handleDataChannelClose;


  }












}






