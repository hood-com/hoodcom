import { createStore } from './index.js';
import * as categoryService from '../services/category-service.js';

export const initialCategoryState = Object.freeze({ categories: [], loading: false, error: null, currentCategory: null, currentItem: null });
export const categoryStore = createStore(initialCategoryState);

export const loadCategories = async (refresh = false) => {
  categoryStore.setState({ loading: true, error: null });
  try {
    const categories = await categoryService.getAllCategories({ refresh });
    categoryStore.setState({ categories, loading: false });
    return categories;
  } catch (error) {
    categoryStore.setState({ loading: false, error: error.message || String(error) });
    throw error;
  }
};

export const addCategory = async (category) => {
  const saved = await categoryService.saveCategoryToFirebase(category);
  categoryStore.setState({ categories: [...categoryStore.getState().categories, saved] });
  return saved;
};

export const updateCategory = async (id, updates) => {
  const existing = categoryStore.getState().categories.find((category) => category.id === String(id));
  if (!existing) throw new Error('القسم غير موجود');
  const saved = await categoryService.saveCategoryToFirebase({ ...existing, ...updates, id: existing.id });
  categoryStore.setState({ categories: categoryStore.getState().categories.map((category) => category.id === saved.id ? saved : category) });
  return saved;
};

export const deleteCategory = async (id) => {
  await categoryService.deleteCategoryFromFirebase(id);
  categoryStore.setState({ categories: categoryStore.getState().categories.filter((category) => category.id !== String(id)) });
  return true;
};

export const setCurrentCategory = (category) => { categoryStore.setState({ currentCategory: category || null, currentItem: null }); return category; };
export const setCurrentItem = (item) => { categoryStore.setState({ currentItem: item || null }); return item; };

export default Object.freeze({ ...categoryStore, loadCategories, addCategory, updateCategory, deleteCategory, setCurrentCategory, setCurrentItem });
