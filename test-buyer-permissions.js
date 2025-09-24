// Test script to check buyer user permissions
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function testBuyerPermissions() {
  try {
    console.log('Testing buyer user permissions...');
    
    // Login as buyer user
    const loginResponse = await fetch(`${API_BASE}/user-auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    const loginData = await loginResponse.json();
    
    if (loginData.success && loginData.data.token) {
      console.log('✓ Buyer login successful');
      console.log('User role:', loginData.data.user.userRole);
      
      const token = loginData.data.token;
      
      // Get buyer permissions
      const permResponse = await fetch(`${API_BASE}/user-auth/my-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const permData = await permResponse.json();
      
      if (permData.success) {
        console.log('\n✓ Buyer permissions fetched:');
        console.table(permData.data.map(p => ({ name: p.name, category: p.category })));
        
        // Check specific permissions
        const permissions = permData.data.map(p => p.name);
        console.log('\nPermission checks:');
        console.log('- View Dashboard:', permissions.includes('View Dashboard'));
        console.log('- buyer.view:', permissions.includes('buyer.view'));
        console.log('- invoice.view:', permissions.includes('invoice.view'));
        console.log('- invoice.create:', permissions.includes('invoice.create'));
        console.log('- product.view:', permissions.includes('product.view'));
        console.log('- report.sales:', permissions.includes('report.sales'));
        
        console.log('\nExpected menu items for buyer:');
        console.log('- Dashboard: ✓');
        console.log('- Buyers: ✓');
        console.log('- Create Invoice: ✓');
        console.log('- Invoice List: ✓');
        console.log('- Products: ✗ (should be hidden)');
        console.log('- Reports: ✗ (should be hidden)');
        
      } else {
        console.log('✗ Failed to fetch permissions:', permData.message);
      }
    } else {
      console.log('✗ Login failed:', loginData.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBuyerPermissions();
