"use client";

import { TableCell } from "@repo/ui/components/ui/table";
import { useEffect, useState } from "react";
import { ClassOption } from "../../types";

export const ClassOptionName = ({ id }: { id: number }) => {
  const [classOption, setClassOption] = useState<ClassOption>();
  useEffect(() => {
    const fetchLessons = async () => {
      const options = await fetch(
        `http://localhost:3000/api/class-options/${id}`
      );
      const data = await options.json();
      console.log("data", data);
      setClassOption(data);
    };
    fetchLessons();
  }, [id]);

  return <TableCell>{classOption?.name}</TableCell>;
};
