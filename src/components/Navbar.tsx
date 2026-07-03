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
import { BookOpen, ChevronDown, Dumbbell, LogOut, Settings, User, UserPlus } from "lucide-react";
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

  return <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="container mx-auto px-4 py-3 sm:px-6">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <Link to="/" className="group flex min-w-0 flex-shrink-0 items-center gap-2.5">
            <img src={logo} alt="Picrete" className="h-8 w-8 flex-shrink-0 sm:h-9 sm:w-9" />
            <span className="truncate font-aptos text-lg font-semibold text-foreground sm:text-xl">
              Picrete
            </span>
          </Link>
          
          <div className="flex flex-shrink-0 items-center gap-2">
            {isAuth && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 rounded-md px-1.5 sm:px-2">
                    <Avatar className="h-8 w-8 cursor-pointer">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
                      {activeCourseTitle ?? user.full_name}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                  {activeCourseId && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate(`/c/${activeCourseId}/task-bank`)}
                        className="cursor-pointer"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        <span>Банк задач</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/c/${activeCourseId}/trainer`)}
                        className="cursor-pointer"
                      >
                        <Dumbbell className="mr-2 h-4 w-4" />
                        <span>Тренажеры</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate("/join-course")} className="cursor-pointer">
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Присоединиться к курсу</span>
                  </DropdownMenuItem>
                  {isAdmin() && (
                    <DropdownMenuItem onClick={openAdmin} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
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
                <Link to="/demo" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Демо
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                    Войти
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="px-3 sm:px-4">
                    <span className="hidden sm:inline">Создать аккаунт</span>
                    <span className="sm:hidden">Старт</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>;
};
