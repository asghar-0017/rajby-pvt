# User Management System

This document describes the User Management System implemented for the FBR Invoice application. The system allows administrators to create users and assign them to specific companies/tenants, enabling role-based access control.

## Features

### For Administrators

- **Create Users**: Create new users with email, password, and personal information
- **Assign Companies**: Assign users to one or more companies/tenants
- **Manage Users**: Edit, delete, and manage user accounts
- **View Assignments**: See which users are assigned to which companies
- **User Management Dashboard**: Complete user management interface

### For Users

- **User Login**: Dedicated login page for regular users
- **Company Access**: Access only assigned companies
- **Automatic Company Selection**: If assigned to only one company, automatic access
- **Multi-Company Support**: If assigned to multiple companies, company selection page

## System Architecture

### Database Schema

#### Users Table

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verify_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expiry DATETIME,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### User-Tenant Assignments Table

```sql
CREATE TABLE user_tenant_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Backend Components

#### Models

- **User.js**: User model with validation and associations
- **UserTenantAssignment.js**: Junction table for user-company assignments
- **associations.js**: Defines relationships between models

#### Services

- **UserManagementService.js**: Core business logic for user management
  - Create, read, update, delete users
  - Assign/remove users from companies
  - Fetch users with their company assignments

#### Controllers

- **userManagementController.js**: API endpoints for user management
- **userAuthController.js**: User authentication endpoints

#### Routes

- **userManagementRoutes.js**: Admin-only routes for user management
- **userAuthRoutes.js**: Public routes for user authentication

### Frontend Components

#### Pages

- **UserManagement.jsx**: Admin dashboard for managing users
- **UserLogin.jsx**: Dedicated login page for regular users

#### Features

- **User Creation Form**: Create new users with company assignments
- **User List Table**: View all users with their assignments
- **Company Assignment Dialog**: Assign users to companies
- **User Edit Form**: Edit user information and assignments
- **Responsive Design**: Mobile-friendly interface

## API Endpoints

### User Management (Admin Only)

- `GET /api/user-management/users` - Get all users
- `GET /api/user-management/users/:id` - Get user by ID
- `POST /api/user-management/users` - Create new user
- `PUT /api/user-management/users/:id` - Update user
- `DELETE /api/user-management/users/:id` - Delete user
- `POST /api/user-management/users/assign-tenant` - Assign user to company
- `POST /api/user-management/users/remove-tenant` - Remove user from company
- `GET /api/user-management/tenants` - Get all companies
- `GET /api/user-management/tenants/:tenantId/users` - Get users by company

### User Authentication

- `POST /api/user-auth/login` - User login
- `GET /api/user-auth/profile` - Get user profile

## Authentication Flow

### User Login Process

1. User enters email and password on `/user-login` page
2. System validates credentials against `users` table
3. System checks if user has company assignments
4. If valid, JWT token is generated with user info and assigned companies
5. User is redirected based on company assignments:
   - Single company: Direct access to dashboard
   - Multiple companies: Company selection page

### Token Structure

```javascript
{
  userId: 123,
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  role: "user",
  type: "user",
  assignedTenants: [
    {
      tenantId: "TENANT_001",
      tenantName: "Company Name",
      databaseName: "tenant_db_001"
    }
  ]
}
```

## Setup Instructions

### 1. Database Setup

Run the setup script to create the required tables:

```bash
cd apps/backend
npm run setup-user-management
```

### 2. Backend Configuration

The system automatically initializes the required models and associations when the server starts.

### 3. Frontend Routes

The following routes are available:

- `/user-login` - User login page
- `/user-management` - Admin user management (admin only)

### 4. Access Control

- **Admin users**: Can access user management from the sidebar
- **Regular users**: Can only access their assigned companies
- **Authentication**: All user management routes require admin authentication

## Usage Guide

### For Administrators

#### Creating a User

1. Navigate to User Management from the admin sidebar
2. Click "Add User" button
3. Fill in user details (email, password, name, phone)
4. Select companies to assign the user to
5. Click "Create"

#### Assigning Companies to Users

1. In the user list, click the assignment icon for a user
2. Select a company from the list
3. The user will be assigned to that company

#### Managing User Assignments

- View all company assignments in the user list
- Remove assignments using the delete icon next to each company
- Edit user information by clicking the edit icon

### For Users

#### Logging In

1. Go to `/user-login` page
2. Enter your email and password
3. If you have access, you'll be redirected to your company dashboard

#### Company Selection

- If assigned to multiple companies, you'll see a company selection page
- Click on a company to access its dashboard
- You can switch between companies as needed

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Different access levels for admin and regular users
- **Company Isolation**: Users can only access their assigned companies
- **Input Validation**: All inputs are validated on both frontend and backend
- **SQL Injection Protection**: Using Sequelize ORM with parameterized queries

## Error Handling

The system includes comprehensive error handling:

- **Validation Errors**: Clear messages for invalid inputs
- **Authentication Errors**: Proper handling of login failures
- **Authorization Errors**: Access denied for unauthorized operations
- **Database Errors**: Graceful handling of database issues
- **Network Errors**: User-friendly error messages for API failures

## Future Enhancements

Potential improvements for the system:

- **Email Verification**: Send verification emails for new users
- **Password Reset**: Self-service password reset functionality
- **User Groups**: Group users for easier management
- **Audit Logging**: Track user actions and changes
- **Bulk Operations**: Import/export users, bulk assignments
- **Advanced Permissions**: Fine-grained permissions within companies
- **Two-Factor Authentication**: Enhanced security for user accounts

## Troubleshooting

### Common Issues

1. **User cannot login**
   - Check if user account is active
   - Verify user has company assignments
   - Check password is correct

2. **Admin cannot access user management**
   - Verify admin role in database
   - Check authentication token
   - Ensure proper permissions

3. **Database connection issues**
   - Verify MySQL connection settings
   - Check if tables exist
   - Run setup script again if needed

### Support

For technical support or questions about the user management system, please contact the development team.
