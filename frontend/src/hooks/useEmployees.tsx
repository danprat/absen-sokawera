import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Employee } from '@/types/attendance';
import { toast } from 'sonner';

/**
 * Custom hook for managing employees with API integration
 * 
 * @example
 * ```tsx
 * const { employees, loading, error, refetch, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
 * ```
 */
export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.employees.list();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
      setError(err as Error);
      toast.error('Gagal memuat data pegawai');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const createEmployee = async (data: {
    name: string;
    position: string;
    phone?: string;
    email?: string;
    join_date?: string;
  }): Promise<Employee | null> => {
    try {
      const newEmployee = await api.employees.create(data);
      setEmployees((prev) => [...prev, newEmployee]);
      toast.success('Pegawai berhasil ditambahkan');
      return newEmployee;
    } catch (err) {
      console.error('Failed to create employee:', err);
      const errorMessage = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Gagal menambahkan pegawai';
      toast.error(errorMessage);
      return null;
    }
  };

  const updateEmployee = async (
    id: string,
    data: {
      name?: string;
      position?: string;
      phone?: string;
      email?: string;
      is_active?: boolean;
    }
  ): Promise<Employee | null> => {
    try {
      const updatedEmployee = await api.employees.update(id, data);
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === id ? updatedEmployee : emp))
      );
      toast.success('Pegawai berhasil diperbarui');
      return updatedEmployee;
    } catch (err) {
      console.error('Failed to update employee:', err);
      const errorMessage = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Gagal memperbarui pegawai';
      toast.error(errorMessage);
      return null;
    }
  };

  const deleteEmployee = async (id: string): Promise<boolean> => {
    try {
      await api.employees.delete(id);
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      toast.success('Pegawai berhasil dihapus');
      return true;
    } catch (err) {
      console.error('Failed to delete employee:', err);
      const errorMessage = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Gagal menghapus pegawai';
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
};
