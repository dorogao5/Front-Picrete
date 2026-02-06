import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-6">
      <Card className="w-full max-w-md p-8 text-center shadow-elegant">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
          404
        </h1>
        <p className="text-xl text-muted-foreground mb-6">
          Страница не найдена
        </p>
        <Link to="/">
          <Button size="lg">Вернуться на главную</Button>
        </Link>
      </Card>
    </div>
  );
};

export default NotFound;
