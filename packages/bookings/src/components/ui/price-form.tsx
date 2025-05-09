import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
export const PriceForm = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Details:</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <span>Price per person</span>
            <span>€10</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>Number of people</span>
            <span>1</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span>Total price</span>
            <span>€100</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
