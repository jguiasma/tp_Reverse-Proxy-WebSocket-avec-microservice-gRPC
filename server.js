const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const messageHistory = [];

// Chemin vers le fichier proto
const PROTO_PATH = path.join(__dirname, 'chat.proto');
// Chargement du fichier proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
keepCase: true,
longs: String,
enums: String,
defaults: true,
oneofs: true,
});
const chatProto = grpc.loadPackageDefinition(packageDefinition).chat;
// Définition d'un utilisateur administrateur de base
const admin = {
id: "admin",
name: "Grpc_Admin",
email: "grpc_admin@mail.com",
status: "ACTIVE",
};
// Implémentation de l'appel GetUser
function getUser(call, callback) {
const userId = call.request.user_id;
console.log(`Requête GetUser reçue pour id: ${userId}`);
// Retourner un utilisateur fictif en se basant sur "admin" et en remplaçantl'id par celui fourni
const user = { ...admin, id: userId };
callback(null, { user });
}



// Implémentation de l'appel Chat (streaming bidirectionnel)
function chat(call) {
  console.log("Flux Chat démarré.");
  call.on('data', (chatStreamMessage) => {
    if (chatStreamMessage.chat_message) {
      const msg = chatStreamMessage.chat_message;
      console.log(`Message reçu de ${msg.sender_id}: ${msg.content}`);

      // Stocker le message dans l’historique
      messageHistory.push(msg);

      // Réponse écho
      const reply = {
        id: msg.id + "_reply",
        room_id: msg.room_id,
        sender_id: admin.name,
        content: "received at " + new Date().toISOString(),
      };
      call.write({ chat_message: reply });
    }
  });

  call.on('end', () => {
    console.log("Fin du flux Chat.");
    call.end();
  });
}

function getChatHistory(call, callback) {
  const roomId = call.request.room_id;
  console.log(`Demande d historique pour la room : ${roomId}`);

  const messages = messageHistory.filter(msg => msg.room_id === roomId);
  callback(null, { messages });
}

  
// Démarrage du serveur gRPC
function main() {
const server = new grpc.Server();
server.addService(chatProto.ChatService.service, {
GetUser: getUser,
Chat: chat,
GetChatHistory: getChatHistory, // 👈



});
const address = '0.0.0.0:50051';
server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error,
port) => {
if (error) {
console.error("Erreur lors du binding du serveur :", error);
return;
}
console.log(`Serveur gRPC en écoute sur ${address}`);
});
}
main();
    