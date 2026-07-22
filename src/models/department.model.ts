export interface Department {
  id: number;
  name: string;
}

export interface DepartmentDTO {
  id: number;
  name: string;
  userCount: number;
  evidenceChecklistCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartment {
  name: string;
}
