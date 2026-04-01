import { useState, useMemo } from "react";

export function useSortableTable<T>(
  data: T[],
  defaultCol: string = "",
  defaultAsc: boolean = true
) {
  const [sortCol, setSortCol] = useState(defaultCol);
  const [sortAsc, setSortAsc] = useState(defaultAsc);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const sortData = (compareFn: (a: T, b: T, col: string) => number) => {
    return useMemo(() => {
      if (!sortCol) return data;
      return [...data].sort((a, b) => {
        const cmp = compareFn(a, b, sortCol);
        return sortAsc ? cmp : -cmp;
      });
    }, [data, sortCol, sortAsc, compareFn]);
  };

  return { sortCol, sortAsc, toggleSort, sortData };
}
