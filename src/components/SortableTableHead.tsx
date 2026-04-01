import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  column: string;
  sortCol: string;
  sortAsc: boolean;
  onSort: (col: string) => void;
  children: React.ReactNode;
}

export function SortableTableHead({ column, sortCol, sortAsc, onSort, children, className, ...props }: SortableTableHeadProps) {
  const isActive = sortCol === column;

  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(column)}
      {...props}
    >
      <span className="flex items-center">
        {children}
        {isActive ? (
          sortAsc ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
        ) : (
          <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}
