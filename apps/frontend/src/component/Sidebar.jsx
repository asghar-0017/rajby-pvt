import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import MuiAppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import { IoIosCreate } from "react-icons/io";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { IoLogOut } from "react-icons/io5";
import InboxIcon from "@mui/icons-material/MoveToInbox";
import { BsFileTextFill } from "react-icons/bs";
import { FaWallet } from "react-icons/fa";
import MailIcon from "@mui/icons-material/Mail";
import CreateInvoice from "../pages/createInvoiceForm";
import { RiHome2Fill } from "react-icons/ri";
import {
  href,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import YourInvoices from "../pages/YourInvoices";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  Button,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemAvatar,
} from "@mui/material";
import { useAuth } from "../Context/AuthProvider";
import { useTenantSelection } from "../Context/TenantSelectionProvider";
import { FaBusinessTime } from "react-icons/fa6";
import { FaUsers } from "react-icons/fa";
import Footer from "./Footer";
import ProfileMenuMount from "./ProfileMenuMount";
// import productionForm  from "../pages/productionForm"

const drawerWidth = 240;

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(
  ({ theme }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    variants: [
      {
        props: ({ open }) => open,
        style: {
          transition: theme.transitions.create("margin", {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
          marginLeft: 0,
        },
      },
    ],
  })
);

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme }) => ({
  backgroundColor: "#2A69B0",
  color: "white",
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(["margin", "width"], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));

export default function Sidebar({ onLogout }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(true); // Set to true for permanently open
  const { user } = useAuth();
  const { selectedTenant, isTenantSelected } = useTenantSelection();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/", icon: <RiHome2Fill /> },
    { name: "Create Invoice", href: "/create-invoice", icon: <IoIosCreate /> },
    { name: "Invoice List", href: "/your-invoices", icon: <BsFileTextFill /> },
    { name: "Buyers", href: "/buyers", icon: <FaWallet /> },
    { name: "Products", href: "/products", icon: <InboxIcon /> },

    { name: "logout" },
  ];

  // Add "Select Company" for admins or users with multiple company assignments
  if (user?.role === "admin") {
    navItems.unshift({
      name: "Select Company",
      href: "/tenant-management",
      icon: <FaBusinessTime />,
    });
    navItems.splice(1, 0, {
      name: "User Management",
      href: "/user-management",
      icon: <FaUsers />,
    });
  } else if (
    user?.role === "user" &&
    user?.assignedTenants &&
    user.assignedTenants.length > 1
  ) {
    // Regular user with multiple company assignments
    navItems.unshift({
      name: "Select Company",
      href: "/tenant-management",
      icon: <FaBusinessTime />,
    });
  }

  // Removed drawer open/close handlers since sidebar is permanently open
  const handleLogoutClick = () => {
    onLogout();
    navigate("/"); // return to login screen
  };

  const [anchorEl, setAnchorEl] = React.useState(null);
  const [profileOpen, setProfileOpen] = React.useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleOpenProfile = () => {
    setProfileOpen(true);
    handleMenuClose();
  };

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          {/* Removed menu button since sidebar is permanently open */}
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontFamily: '"Kumbh Sans", sans-serif', fontWeight: 700 }}
          >
            FBR Invoices
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleMenuOpen} color="inherit">
            <Avatar
              sx={{ width: 32, height: 32 }}
              src={user?.photo_profile || undefined}
            >
              {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <MenuItem disabled>
              <ListItemAvatar>
                <Avatar src={user?.photo_profile || undefined} />
              </ListItemAvatar>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleOpenProfile}>Update Profile</MenuItem>
            <MenuItem onClick={handleLogoutClick}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          {/* Logo at the top of sidebar */}
          {/* <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              padding: "16px",
            }}
          >
            <img
              src="/images/Pakprogressive.png"
              alt="Pak Progressive"
              style={{
                // maxWidth: "100%",
                width: "2500px",
                height: "100%",
                maxHeight: "60px",
                objectFit: "cover",
              }}
            />
          </Box> */}
        </DrawerHeader>
        <List>
          {navItems.map((item, index) => {
            const isLogout = item.name.toLowerCase() === "logout";

            return isLogout ? (
              <ListItem key={item.name} disablePadding onClick={onLogout}>
                <ListItemButton
                  sx={{
                    borderRadius: "8px",
                    margin: "4px 8px",
                    "&:hover": {
                      backgroundColor: "#2A69B0",
                      "& .MuiListItemIcon-root": {
                        color: "white",
                      },
                      "& .MuiTypography-root": {
                        color: "white",
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: "black" }}>
                    <IoLogOut style={{ fontSize: 24 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="Logout"
                    sx={{
                      "& .MuiTypography-root": {
                        color: "black",
                        fontWeight: 700,
                        fontFamily: '"Kumbh Sans", sans-serif !important',
                      },
                    }}
                    style={{ fontFamily: '"Kumbh Sans", sans-serif' }}
                  />
                </ListItemButton>
              </ListItem>
            ) : (
              <NavLink
                key={item.name}
                to={item.href}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <ListItem disablePadding>
                  <ListItemButton
                    sx={{
                      borderRadius: "8px",
                      margin: "4px 8px",
                      backgroundColor:
                        location.pathname === item.href
                          ? "#2A69B0"
                          : "transparent",
                      "&:hover": {
                        backgroundColor: "#2A69B0",
                        "& .MuiListItemIcon-root": {
                          color: "white",
                        },
                        "& .MuiTypography-root": {
                          color: "white",
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color:
                          location.pathname === item.href ? "white" : "black",
                      }}
                    >
                      {item.icon ? (
                        React.cloneElement(item.icon, {
                          style: { fontSize: 24 },
                        })
                      ) : index % 2 === 0 ? (
                        <InboxIcon sx={{ fontSize: 24 }} />
                      ) : (
                        <MailIcon sx={{ fontSize: 24 }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.name}
                      sx={{
                        "& .MuiTypography-root": {
                          color:
                            location.pathname === item.href ? "white" : "black",
                          fontWeight: 700,
                          fontFamily: '"Kumbh Sans", sans-serif !important',
                        },
                      }}
                      style={{ fontFamily: '"Kumbh Sans", sans-serif' }}
                    />
                  </ListItemButton>
                </ListItem>
              </NavLink>
            );
          })}
        </List>

        <Divider />
      </Drawer>

      <Main open={open}>
        <DrawerHeader />
        <Outlet />
        {/* Profile Modal */}
        <ProfileMenuMount open={profileOpen} setOpen={setProfileOpen} />
        <Footer />
      </Main>
    </Box>
  );
}
