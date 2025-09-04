# Company Access Control for User Management

## Problem Statement

The issue was that admins could assign users to any company in the system, regardless of their own access permissions. This violates the principle of least privilege and can lead to security issues.

## Solution: Implement Access Control

### 1. Component Props Update

The `CreateUserModal` now accepts a `currentUserAccess` prop that restricts which companies can be assigned:

```jsx
<CreateUserModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onSave={handleCreateUser}
  companies={companies}
  currentUserAccess={currentUserAccess} // NEW: Array of company IDs the current user can access
/>
```

### 2. Access Control Logic

Inside the modal, companies are filtered based on the current user's access:

```jsx
// Filter companies based on current user's access
const accessibleCompanies =
  currentUserAccess.length > 0
    ? companies.filter((company) => currentUserAccess.includes(company.id))
    : companies;
```

### 3. Usage Examples

#### Example 1: Admin with Limited Access

```jsx
const UserManagementDemo = () => {
  // Admin only has access to Company A and B
  const currentUserAccess = ["company-a", "company-b"];

  return (
    <CreateUserModal
      // ... other props
      currentUserAccess={currentUserAccess}
    />
  );
};
```

#### Example 2: User with Single Company Access

```jsx
const UserFormExample = () => {
  // This user only has access to Company A
  const currentUserAccess = ["company-a"];

  return (
    <CreateUserModal
      // ... other props
      currentUserAccess={currentUserAccess}
    />
  );
};
```

### 4. Backend Integration

#### Get Current User's Company Access

```javascript
// In your backend API
app.get("/api/user/company-access", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get companies the current user has access to
    const userCompanies = await getUserCompanyAccess(userId);

    res.json({
      success: true,
      companies: userCompanies.map((c) => c.id),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### Create User with Access Control

```javascript
// In your backend API
app.post("/api/users", authenticateToken, async (req, res) => {
  try {
    const adminId = req.user.id;
    const { assignedCompanies, ...userData } = req.body;

    // Verify admin has access to all assigned companies
    const adminAccess = await getUserCompanyAccess(adminId);
    const hasAccess = assignedCompanies.every((companyId) =>
      adminAccess.some((access) => access.id === companyId)
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error:
          "You don't have permission to assign users to some of these companies",
      });
    }

    // Create user with verified company access
    const newUser = await createUser(userData, assignedCompanies);

    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 5. Database Schema Considerations

#### User Company Access Table

```sql
CREATE TABLE user_company_access (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  company_id VARCHAR(50) NOT NULL,
  access_level ENUM('read', 'write', 'admin') DEFAULT 'read',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY unique_user_company (user_id, company_id)
);
```

#### Company Table

```sql
CREATE TABLE companies (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Frontend Context Integration

#### Auth Context with Company Access

```jsx
// In your auth context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [companyAccess, setCompanyAccess] = useState([]);

  const login = async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    const { user, companyAccess } = response.data;

    setUser(user);
    setCompanyAccess(companyAccess);
  };

  return (
    <AuthContext.Provider value={{ user, companyAccess, login }}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### Using Company Access in Components

```jsx
import { useAuth } from "../contexts/AuthContext";

const UserManagement = () => {
  const { companyAccess } = useAuth();

  return (
    <CreateUserModal
      // ... other props
      currentUserAccess={companyAccess}
    />
  );
};
```

### 7. Security Best Practices

1. **Always verify access on the backend** - Frontend filtering is for UX only
2. **Use JWT tokens** with company access claims
3. **Implement role-based access control** (RBAC) for different permission levels
4. **Log all user creation and company assignment actions**
5. **Regular audit of user-company relationships**

### 8. Testing Access Control

#### Test Cases

```javascript
describe("Company Access Control", () => {
  test("Admin can only assign users to accessible companies", async () => {
    const adminAccess = ["company-a", "company-b"];
    const modal = render(<CreateUserModal currentUserAccess={adminAccess} />);

    // Should only show companies A and B in dropdown
    expect(modal.getByText("Company A")).toBeInTheDocument();
    expect(modal.getByText("Company B")).toBeInTheDocument();
    expect(modal.queryByText("Company C")).not.toBeInTheDocument();
  });

  test("User cannot be assigned to inaccessible companies", async () => {
    // Test backend API endpoint
    const response = await request(app)
      .post("/api/users")
      .send({
        assignedCompanies: ["company-c"], // Company admin doesn't have access to
        // ... other user data
      });

    expect(response.status).toBe(403);
  });
});
```

## Summary

By implementing this access control system:

1. ✅ **Users can only be assigned to companies the admin has access to**
2. ✅ **Frontend shows only accessible companies in dropdowns**
3. ✅ **Backend validates all company assignments**
4. ✅ **Security is maintained at multiple levels**
5. ✅ **User experience is clear about access limitations**

This ensures that "Asghar" (or any user) will only see and be assigned to companies that the admin actually has permission to manage, solving the original issue.
