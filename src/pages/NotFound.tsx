import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-notebook px-6">
      <Card className="w-full max-w-md p-10 text-center shadow-elegant">
        <p className="font-display text-7xl font-semibold text-accent">404</p>
        <h1 className="mt-3 text-xl font-semibold">Такой страницы нет</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Возможно, ссылка устарела или страница была перемещена.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button size="lg">На главную</Button>
        </Link>
      </Card>
    </div>
  );
};

export default NotFound;
