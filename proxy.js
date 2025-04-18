const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const WebSocket = require('ws');
const path = require('path');

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

// Fonction pour créer un client gRPC
function createGrpcClient() {
    return new chatProto.ChatService('localhost:50051',
        grpc.credentials.createInsecure());
}

// Création d'un serveur WebSocket servant de reverse proxy
const wss = new WebSocket.Server({ port: 8080 });
console.log('Reverse proxy WebSocket en écoute sur ws://localhost:8080');

// Lorsque le client WebSocket se connecte
wss.on('connection', (ws) => {
    console.log('Client WebSocket connecté');

    const grpcClient = createGrpcClient();
    const grpcStream = grpcClient.Chat(); // ouverture d'un stream côté gRPC

    // Envoie les messages gRPC vers le client WebSocket
    grpcStream.on('data', (chatStreamMessage) => {
        console.log('Message reçu du serveur gRPC:', chatStreamMessage);
        ws.send(JSON.stringify(chatStreamMessage));
    });

    grpcStream.on('error', (err) => {
        console.error('Erreur dans le stream gRPC:', err);
        ws.send(JSON.stringify({ error: err.message }));
    });

    grpcStream.on('end', () => {
        console.log('Stream gRPC terminé.');
        ws.close();
    });

    //  Écoute les messages WebSocket (venant du client)
    ws.on('message', (message) => {
        console.log('Message reçu du client WebSocket:', message);
        try {
            const parsed = JSON.parse(message);

            // S'il s'agit d'une demande d'historique
            if (parsed.type === 'get_history' && parsed.room_id) {
                grpcClient.GetChatHistory({ room_id: parsed.room_id }, (err, response) => {
                    if (err) {
                        ws.send(JSON.stringify({ error: err.message }));
                    } else {
                        ws.send(JSON.stringify({ history: response.messages }));
                    }
                });
            } else {
                grpcStream.write(parsed);
            }
        } catch (err) {
            console.error('Erreur lors de la conversion du message JSON:', err);
            ws.send(JSON.stringify({ error: 'Format JSON invalide' }));
        }
    });

    // Quand le client WebSocket ferme la connexion
    ws.on('close', () => {
        console.log('Client WebSocket déconnecté');
        grpcStream.end();
    });
});
