import { createStore } from './index.js';
import * as orderService from '../services/order-service.js';

export const initialOrderState = Object.freeze({ orders: [], currentOrder: null, loading: false, error: null, orderHistory: [] });
export const orderStore = createStore(initialOrderState);

export const createOrder = async (orderData) => {
  orderStore.setState({ loading: true, error: null });
  try {
    const order = await orderService.createOrder(orderData);
    orderStore.setState({ orders: [order, ...orderStore.getState().orders], currentOrder: order, loading: false });
    return order;
  } catch (error) {
    orderStore.setState({ loading: false, error: error.message || String(error) }); throw error;
  }
};

export const fetchOrders = async (userId) => {
  orderStore.setState({ loading: true, error: null });
  try {
    const orders = await orderService.getUserOrders(userId);
    orderStore.setState({ orders, orderHistory: orders.slice(), loading: false });
    return orders;
  } catch (error) {
    orderStore.setState({ loading: false, error: error.message || String(error) }); throw error;
  }
};

export const updateOrder = async (id, status, extra = {}) => {
  const order = await orderService.updateOrderStatus(id, status, extra);
  orderStore.setState({
    orders: orderStore.getState().orders.map((entry) => entry.id === String(id) ? order : entry),
    currentOrder: orderStore.getState().currentOrder?.id === String(id) ? order : orderStore.getState().currentOrder
  });
  return order;
};

export const setCurrentOrder = (order) => { orderStore.setState({ currentOrder: order || null }); return order; };
export const clearCurrentOrder = () => { orderStore.setState({ currentOrder: null }); return null; };

export default Object.freeze({ ...orderStore, createOrder, fetchOrders, updateOrder, setCurrentOrder, clearCurrentOrder });
