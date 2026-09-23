// game/RoomManager.js
const { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } = require('./constants');
const GameRoom = require('./GameRoom');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map(); // roomCode -> GameRoom
    this.socketToRoom = new Map(); // socketId -> { roomCode, playerId }
  }

  generateRoomCode() {
    let code = '';
    const maxAttempts = 1000;
    let attempts = 0;

    do {
      code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
        code += ROOM_CODE_CHARS[idx];
      }
      attempts++;
    } while (this.rooms.has(code) && attempts < maxAttempts);

    if (this.rooms.has(code)) {
      throw new Error('Unable to allocate unique room code. Server capacity reached.');
    }
    return code;
  }

  createRoom(hostData) {
    const code = this.generateRoomCode();
    const room = new GameRoom(code, hostData, this.io, (destroyedCode) => {
      this.destroyRoom(destroyedCode);
    });

    this.rooms.set(code, room);
    this.socketToRoom.set(hostData.socketId, { roomCode: code, playerId: hostData.id });
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.trim().toUpperCase());
  }

  joinRoom(rawCode, playerData) {
    const code = (rawCode || '').trim().toUpperCase();
    const room = this.rooms.get(code);

    if (!room) {
      throw new Error('Room not found. Check your code.');
    }

    // Check reconnection
    if (playerData.id && room.players.has(playerData.id)) {
      const existingPlayer = room.players.get(playerData.id);
      const reconnectedPlayer = room.handleReconnect(playerData.id, playerData.socketId);
      if (reconnectedPlayer) {
        this.socketToRoom.set(playerData.socketId, { roomCode: code, playerId: playerData.id });
        return { room, player: reconnectedPlayer, isReconnect: true };
      }
    }

    if (room.status !== 'LOBBY') {
      throw new Error('This game is already in progress.');
    }

    if (room.players.size >= 8) {
      throw new Error('This room is full (8/8 players).');
    }

    const player = room.addPlayer(playerData);
    this.socketToRoom.set(playerData.socketId, { roomCode: code, playerId: player.id });
    return { room, player, isReconnect: false };
  }

  handleDisconnect(socketId) {
    const binding = this.socketToRoom.get(socketId);
    if (!binding) return;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(binding.roomCode);
    if (room) {
      room.handleDisconnect(binding.playerId);
    }
  }

  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      // Clean up socket bindings
      for (const [sId, b] of this.socketToRoom.entries()) {
        if (b.roomCode === code) {
          this.socketToRoom.delete(sId);
        }
      }
      this.rooms.delete(code);
    }
  }
}

module.exports = RoomManager;
