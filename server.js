import http from 'node:http';
import { readFile } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
import { Server } from 'socket.io';
import notifier from 'node-notifier';

const PUERTO = 8080;

let estado = {
    luminosidad: 0,
    temperatura: 0,
    presencia: true,
    persiana: 'ABIERTA',
    aire: 'APAGADO',
    tempExterior: 0
};

// lista global de alarmas 
let alarmas = [];

const MAX_LUZ = 80;
const MAX_TEMP = 30;
const MIN_TEMP = 15;

const httpServer = http.createServer((request, response) => {

    let { url } = request;

    // la página principal por defecto es la del usuario
    if (url == '/') url = '/usuario.html';

    // se construye la ruta del archivo
    const filename = join(process.cwd(), url);

    // lee el archivo: 
    // - si da error devuelve un mensaje de error
    // - si no hay errores, envia el contenido al cliente
    readFile(filename, (err, data) => {

        if (!err) {
            let tipo = 'text/html';

            if (url.endsWith('.js'))
                tipo = 'text/javascript';
            else if (url.endsWith('.css'))
                tipo = 'text/css';

            response.writeHead(200, {
                'Content-Type': `${tipo}; charset=utf-8`
            });
            response.write(data);

        } else {

            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write('404 Not Found');
        }

        // se finaliza la respuesta HTTP
        response.end();

    });

});

// se crea el servidor socket.io asociado al servidor HTTP
const io = new Server(httpServer);

io.sockets.on('connection', async (client) => {

    console.log('Cliente conectado');

    // enviar estado y alarmas actuales al conectar
    client.emit('update-data', estado);
    client.emit('alarm-update', alarmas);

    // enviar historial inicial al cliente que se acaba de conectar
    actualizarHistorial(client);

    // actualizar sensores
    client.on('sensor-data', async (data) => {

        estado.temperatura = parseFloat(data.temperatura);
        estado.luminosidad = parseFloat(data.luminosidad);
        // guarda en presencia un valor verdadero solo si el dato es true o 'true'
        estado.presencia = data.presencia === true || data.presencia === 'true';

        // lista local de nuevas alarmas
        let nuevasAlarmas = [];

        // si la luminosidad es mayor a MAX_LUZ (80%) se cierra la persiana y se añade una alarma
        if (estado.luminosidad > MAX_LUZ && estado.persiana !== 'CERRADA') {
            estado.persiana = 'CERRADA';
            nuevasAlarmas.push('Luminosidad demasiado alta: cerrando persiana');
        }

        // si la temperatura es menor a MIN_TEMP se apaga el aire y se añade una alarma
        if (estado.temperatura < MIN_TEMP && estado.aire !== 'APAGADO') {
            estado.aire = 'APAGADO';
            nuevasAlarmas.push('Temperatura demasiado baja: apagando aire');
        }

        // si la temperatura es mayor a MAX_TEMP se enciende el aire y se añade una alarma
        if (estado.temperatura > MAX_TEMP && estado.aire !== 'ENCENDIDO') {
            // si fuera hace más fresco, sugerir abrir ventanas
            if (parseFloat(estado.tempExterior) < estado.temperatura) {
                const msjSugerencia = `Sugerencia: Exterior fresco (${estado.tempExterior}ºC). Mejor abrir ventanas.`;
                // evita el spam si la última alarma ya fue esta sugerencia
                if (alarmas.length === 0 || alarmas[alarmas.length - 1] !== msjSugerencia) {
                    nuevasAlarmas.push(msjSugerencia);
                }
            } else {
                estado.aire = 'ENCENDIDO';
                nuevasAlarmas.push('Temperatura demasiado alta: encendiendo aire');
            }
        }

        // se apaga el aire si no hay presencia (ahorro energético)
        if (!estado.presencia && estado.aire === 'ENCENDIDO') {
            estado.aire = 'APAGADO';
            nuevasAlarmas.push('Ahorro energético: Aire apagado por ausencia');
        }

        if (nuevasAlarmas.length > 0) {
            // añade las nuevas alarmas a la lista global una a una
            alarmas.push(...nuevasAlarmas);

            // notificación de escritorio (paquete externo)
            notifier.notify({
                title: 'Alerta Domótica',
                message: nuevasAlarmas[nuevasAlarmas.length - 1],
                sound: false
            });

            // guarda cada alarma como un documento en la colección
            for (const alarma of nuevasAlarmas) {
                await collection.insertOne({
                    tipo: 'alarma',
                    mensaje: alarma,
                    fecha: new Date()
                });
            }
        }

        // guarda el evento de sensor en MongoDB
        await collection.insertOne({
            tipo: 'sensor',
            temperatura: estado.temperatura,
            luminosidad: estado.luminosidad,
            presencia: estado.presencia,
            fecha: new Date()
        });

        // actualiza y envia el historial completo a todos los clientes
        actualizarHistorial();

        // envia las alarmas actuales del sistema a todos los clientes
        io.sockets.emit('alarm-update', alarmas);

        // envia el estado actual del sistema a todos los clientes
        io.sockets.emit('update-data', estado);

    });

    // actualizar actuadores
    client.on('actuador-change', async (data) => {

        if (data.actuador == 'persiana')
            estado.persiana = data.estado;
        else if (data.actuador == 'aire')
            estado.aire = data.estado;

        io.sockets.emit('update-data', estado);

        await collection.insertOne({
            tipo: 'actuador',
            actuador: data.actuador,
            estado: data.estado,
            fecha: new Date()
        });

        actualizarHistorial();
    })
});

// conexión a la base de datos
const db = await MongoClient.connect(
    'mongodb://localhost:27017/'
);

// crea la base de datos domotica
const dbo = db.db('domotica');

// crea una coleccion de eventos
const collection = dbo.collection('eventos');

// cargar alarmas previas de la base de datos para que sean persistentes al reiniciar/recargar
const alarmasDB = await collection.find({ tipo: 'alarma' })
                                  .sort({ fecha: -1 })
                                  .limit(10)
                                  .toArray();
alarmas = alarmasDB.map(a => a.mensaje).reverse();

// el servidor comienza a escuchar en el puerto 8080
httpServer.listen(PUERTO);
console.log('Servidor iniciado en puerto 8080');

// función auxiliar para refrescar el historial
async function actualizarHistorial(destino = io.sockets) {
    // busca eventos, los ordena por fecha (descendente), limita a 50 y los convierte a array
    const historial = await collection.find()
                                    .sort({ fecha: -1 }) // ordena cronológicamente descendente
                                    .limit(50) // limita a 50 eventos
                                    .toArray();
    destino.emit('history-update', historial.reverse());
}

// función para obtener el clima exterior (API Externa)
async function actualizarClima() {
    try {
        // consulta la temperatura actual de Granada
        const res = await fetch('https://wttr.in/Granada?format=%t');
        // esperamos a que la API nos devuelva la respuesta
        const text = await res.text();
        
        // limpiamos el texto y lo convertimos a número
        const tempParseada = parseFloat(text.replace('°C', '').trim());

        // si el dato es válido, actualiza el estado y avisa a los clientes
        if (!isNaN(tempParseada)) {
            estado.tempExterior = tempParseada;
            io.sockets.emit('update-data', estado);
        }
    } catch (e) {
        console.log('Error al obtener clima');
    }
}

// inicia la función de actualizar clima cada 10 minutos
actualizarClima();
setInterval(actualizarClima, 600000);
