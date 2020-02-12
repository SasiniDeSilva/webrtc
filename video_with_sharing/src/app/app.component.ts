import { Component } from '@angular/core';
import { environment } from '../environments/environment';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // title = 'webrtc';
  userList: string[] = [];
  private answeredUsers: string[] = [];
  private offeredUsers: string[] = [];

  username: string;
  connectedUser;
  callToUsername: string;
  conn;
  localConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  sendDataChannel: RTCDataChannel;
  receiveDataChannel: RTCDataChannel;
  logged = false;
  localVideo: any;
  remoteVideo: any;
  userConnected = false;
  socketConnection:string;
  websocketurl:string;
  constructor() {
    
  }
 

  ngOnInit() {
   
    this.localVideo = document.querySelector('video#local-video');
    this.remoteVideo = document.querySelector('video#remote-video');
    this.connectSignalServer();

  }



  public connectSignalServer() {
    //connecting to our signaling server 
    this.conn = new WebSocket(environment.websocketUrl);

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


  public handleLogin(success) {
    if (success === false) {
      alert("Ooops...try a different username");
    }
    else {
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
    this.userConnected = true;
  }

  //when we got an ice candidate from a remote user 
  public handleCandidate(candidate) {
    this.localConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public handleLeave() {
    this.connectedUser = null;
    this.localConnection.close();
    this.localConnection.onicecandidate = null;
  }


  //create peer Connection
  public createPeerConnection() {
    let configuration = { iceServers: [{ urls: 'stun:stun.example.org' }] };

    this.localConnection = new RTCPeerConnection(configuration);

    console.log('Created local peer connection object localConnection');

    if (navigator.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then
        (stream => {
          this.localVideo['srcObject'] = stream;
          //  this.localConnection['addStream'](stream);
          for (const track of stream.getTracks()) {
            this.localConnection.addTrack(track, stream);
          }
        },
        function (err) {
          console.log("The following error occurred: " + err.name);
        })
    }
    else {
      console.log("getUserMedia not supported");
    }

    //when a remote user adds stream to the peer connection, we display it 
    this.localConnection.ontrack = ((e) => {
      this.remoteVideo['srcObject'] = e.streams[0];
    }).bind(this);



    //when a remote user adds stream to the peer connection, we display it 
    //    this.localConnection['onaddstream'] = ((e)=> { 
    //    this.remoteVideo['srcObject'] = e.stream; 
    //  }).bind(this);





    this.localConnection.onicecandidate = ((event) => {
      if (event.candidate) {
        this.sendConnectionMessage({
          type: "candidate",
          candidate: event.candidate
        });
      }
    }).bind(this);
  }


  public ShareScreen() {
    const config =
      {
        audio: false,
      }

    config['video'] = {
      mandatory: {
        chromeMediaSource: 'screen',
        maxWidth: 1280,
        maxHeight: 720
      },
      optional: []
    }

    navigator.mediaDevices.getUserMedia(config).then
      (stream => {

        //this.localConnection.removeTrack(this.sender)
        this.localVideo['srcObject'] = stream;

        for (const track of stream.getTracks()) {
          this.localConnection.addTrack(track, stream);
        }
        this.CallToUser();
      },
      function (err) {
        console.log("The following error occurred: " + err.name);
      });
  }
}






