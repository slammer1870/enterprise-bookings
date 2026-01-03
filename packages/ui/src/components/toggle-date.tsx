export interface ToggleDateProps {
  date: Date;
  setDate: (_date: Date) => void;
}

export function ToggleDate(props: ToggleDateProps) {
  const { date, setDate } = props;

  const handleChange = (amount: number) => {
    setDate(new Date(date.setDate(date.getDate() + amount)));
  };

  return (
    <>
      <div className="mx-auto mb-8 flex w-full max-w-screen-sm items-center justify-between">
        <svg
          onClick={() => handleChange(-1)}
          viewBox="0 0 13 15"
          className="h-4 w-4 fill-inherit"
        >
          <path
            id="Polygon_2"
            data-name="Polygon 2"
            d="M7.5,0,15,13H0Z"
            transform="translate(0 15) rotate(-90)"
          />
        </svg>
        <p className="text-lg">{date.toDateString()}</p>
        <svg
          onClick={() => handleChange(+1)}
          viewBox="0 0 13 15"
          className="h-4 w-4 fill-inherit"
        >
          <path
            id="Polygon_3"
            data-name="Polygon 3"
            d="M7.5,0,15,13H0Z"
            transform="translate(13) rotate(90)"
          />
        </svg>
      </div>
    </>
  );
}
