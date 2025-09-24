// Test script to verify permission system
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function testUserLogin() {
  try {
    console.log('Testing user login...');
    
    // Test with a user that has buyer permissions
    const response = await fetch(`${API_BASE}/user-auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com', // Replace with actual test user email
        password: 'password123' // Replace with actual test user password
      })
    });

    const data = await response.json();
    console.log('Login response:', JSON.stringify(data, null, 2));

    if (data.success && data.data.token) {
      const token = data.data.token;
      const user = data.data.user;
      
      console.log('\nUser data:');
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- Role:', user.role);
      console.log('- Role ID:', user.roleId);
      console.log('- User Role:', user.userRole);

      // Test fetching permissions
      console.log('\nTesting permission fetch...');
      const permResponse = await fetch(`${API_BASE}/user-auth/my-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const permData = await permResponse.json();
      console.log('Permissions response:', JSON.stringify(permData, null, 2));
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

testUserLogin();
