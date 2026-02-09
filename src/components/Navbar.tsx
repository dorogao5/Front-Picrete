import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { User, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import {
  getActiveCourseId,
  getCourseHomePath,
  getDefaultAppPath,
  getMemberships,
  getUser,
  isAdmin,
  isAuthenticated,
  logout,
  setActiveCourseId,
} from "@/lib/auth";

export const Navbar = () => {
  const navigate = useNavigate();
  const isAuth = isAuthenticated();
  const user = getUser();
  const activeCourseId = getActiveCourseId();
  const memberships = getMemberships().filter((membership) => membership.status === "active");

  const getInitials = (fullName: string) => {
    const names = fullName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logout();
  };

  const handleProfile = () => {
    navigate(getDefaultAppPath());
  };

  const handleSwitchCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    navigate(getCourseHomePath(courseId));
  };

  const activeCourseTitle =
    memberships.find((membership) => membership.course_id === activeCourseId)?.course_title ?? null;

  const roleLabel = user?.is_platform_admin ? "Platform Admin" : "User";

  const displayUsername = user?.username ?? "";

  const openAdmin = () => {
    if (isAdmin()) {
      navigate("/admin");
    }
  };

  return <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0 min-w-0">
            <img src={logo} alt="Picrete" className="h-8 w-8 sm:h-10 sm:w-10 transition-transform duration-300 group-hover:scale-110 flex-shrink-0" />
            <span style={{
            color: '#414141'
          }} className="text-lg sm:text-2xl font-bold font-aptos -ml-2 mt-1 truncate">
              Picrete
            </span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {isAuth && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 cursor-pointer">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.full_name}</p>
                      <p className="text-xs leading-none text-muted-foreground">@{displayUsername}</p>
                      <p className="text-xs leading-none text-muted-foreground">{roleLabel}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {memberships.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground">Курс</div>
                      {memberships.map((membership) => (
                        <DropdownMenuItem
                          key={membership.course_id}
                          onClick={() => handleSwitchCourse(membership.course_id)}
                          className="cursor-pointer"
                        >
                          <span className={membership.course_id === activeCourseId ? "font-semibold" : ""}>
                            {membership.course_title}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      {activeCourseTitle && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                          Активный: {activeCourseTitle}
                        </div>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Профиль</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/join-course")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Присоединиться к курсу</span>
                  </DropdownMenuItem>
                  {isAdmin() && (
                    <DropdownMenuItem onClick={openAdmin} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Админка</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Выйти</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4">
                    Войти
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="text-xs sm:text-sm px-2 sm:px-4">
                    <span className="hidden sm:inline">Начать работу</span>
                    <span className="sm:hidden">Начать</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>;
};
