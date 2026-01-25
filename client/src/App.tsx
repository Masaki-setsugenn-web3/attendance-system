import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import EmployeeSetup from "./pages/EmployeeSetup";
import Attendance from "./pages/Attendance";
import History from "./pages/History";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMap from "./pages/AdminMap";
import AdminSettings from "./pages/AdminSettings";
import AdminTeamTasks from "./pages/AdminTeamTasks";

function Router() {
  return (
    <Switch>
      <Route path="/" component={EmployeeSetup} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/history" component={History} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/map" component={AdminMap} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/team-tasks" component={AdminTeamTasks} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
