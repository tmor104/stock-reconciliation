export class AuthService {
    static async login(username, password, env) {
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        const user = users.find(u => u.username === username && u.password === password);
        
        if (!user) {
            return null;
        }
        
        // Generate simple token (in production, use JWT)
        const token = await this.generateToken(user);
        
        return {
            username: user.username,
            role: user.role,
            token
        };
    }
    
    static async generateToken(user) {
        const payload = JSON.stringify({
            username: user.username,
            role: user.role,
            exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        });
        
        const encoder = new TextEncoder();
        const data = encoder.encode(payload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    static async validateToken(token, env) {
        // Simple validation - in production, use proper JWT validation
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        // For now, we'll store active tokens in KV
        const tokenData = await env.STOCKTAKE_KV.get(`token:${token}`, { type: 'json' });
        
        if (!tokenData || tokenData.exp < Date.now()) {
            return null;
        }
        
        const user = users.find(u => u.username === tokenData.username);
        return user || null;
    }
    
    static async getUsers(env) {
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        // Don't return passwords
        return users.map(u => ({
            username: u.username,
            role: u.role
        }));
    }
    
    static async addUser(username, password, role, env) {
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        // Check if user already exists
        if (users.find(u => u.username === username)) {
            throw new Error('User already exists');
        }
        
        users.push({
            username,
            password, // Already hashed from frontend
            role
        });
        
        await env.STOCKTAKE_KV.put('users', JSON.stringify(users));
    }
    
    static async deleteUser(username, env) {
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        const filteredUsers = users.filter(u => u.username !== username);
        
        if (filteredUsers.length === users.length) {
            throw new Error('User not found');
        }
        
        await env.STOCKTAKE_KV.put('users', JSON.stringify(filteredUsers));
    }
    
    static async updatePassword(username, newPassword, env) {
        const usersJson = await env.STOCKTAKE_KV.get('users', { type: 'json' });
        const users = usersJson || [];
        
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }
        
        // Update password (should already be hashed from frontend)
        users[userIndex].password = newPassword;
        
        await env.STOCKTAKE_KV.put('users', JSON.stringify(users));
        
        return { success: true };
    }
}
