/**
 * Tests for Optimistic UI Utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  optimisticUpdate,
  optimisticToggle,
  OptimisticList,
} from '../public/utils/optimistic.js';

describe('Optimistic UI Utilities', () => {
  describe('optimisticUpdate', () => {
    it('should execute optimistic update immediately', async () => {
      const updateFn = vi.fn();
      const asyncFn = vi.fn().mockResolvedValue('success');
      const rollbackFn = vi.fn();

      await optimisticUpdate(updateFn, asyncFn, rollbackFn);

      expect(updateFn).toHaveBeenCalled();
      expect(asyncFn).toHaveBeenCalled();
      expect(rollbackFn).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const updateFn = vi.fn();
      const asyncFn = vi.fn().mockRejectedValue(new Error('API Error'));
      const rollbackFn = vi.fn().mockReturnValue({ snapshot: 'data' });

      await expect(
        optimisticUpdate(updateFn, asyncFn, rollbackFn)
      ).rejects.toThrow('API Error');

      expect(updateFn).toHaveBeenCalled();
      expect(rollbackFn).toHaveBeenCalledWith({ snapshot: 'data' });
    });

    it('should call success callback', async () => {
      const updateFn = vi.fn();
      const asyncFn = vi.fn().mockResolvedValue('result');
      const rollbackFn = vi.fn();
      const onSuccess = vi.fn();

      await optimisticUpdate(updateFn, asyncFn, rollbackFn, {
        onSuccess,
      });

      expect(onSuccess).toHaveBeenCalledWith('result');
    });

    it('should call error callback', async () => {
      const updateFn = vi.fn();
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const rollbackFn = vi.fn();
      const onError = vi.fn();

      await expect(
        optimisticUpdate(updateFn, asyncFn, rollbackFn, { onError })
      ).rejects.toThrow();

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('optimisticToggle', () => {
    it('should toggle value optimistically', async () => {
      let value = false;
      const updateFn = vi.fn((newValue) => {
        value = newValue;
      });
      const asyncFn = vi.fn().mockResolvedValue(true);

      await optimisticToggle(value, updateFn, asyncFn);

      expect(updateFn).toHaveBeenCalledWith(true);
      expect(asyncFn).toHaveBeenCalledWith(true);
    });

    it('should revert on error', async () => {
      let value = false;
      const updateFn = vi.fn((newValue) => {
        value = newValue;
      });
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(
        optimisticToggle(value, updateFn, asyncFn)
      ).rejects.toThrow();

      // Should have called updateFn twice: once for toggle, once for revert
      expect(updateFn).toHaveBeenCalledTimes(2);
      expect(updateFn).toHaveBeenNthCalledWith(1, true);
      expect(updateFn).toHaveBeenNthCalledWith(2, false);
    });
  });

  describe('OptimisticList', () => {
    let list;
    let listener;

    beforeEach(() => {
      list = new OptimisticList([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);
      listener = vi.fn();
      list.subscribe(listener);
    });

    it('should initialize with items', () => {
      expect(list.getItems()).toHaveLength(2);
    });

    it('should notify listeners on changes', () => {
      list.setItems([{ id: 3, name: 'Item 3' }]);
      expect(listener).toHaveBeenCalled();
    });

    it('should add item optimistically', async () => {
      const asyncFn = vi.fn().mockResolvedValue({
        id: 3,
        name: 'Item 3',
      });

      await list.add({ name: 'Item 3' }, asyncFn);

      const items = list.getItems();
      expect(items).toHaveLength(3);
      expect(items[2].name).toBe('Item 3');
    });

    it('should remove item on add failure', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(
        list.add({ name: 'Item 3' }, asyncFn)
      ).rejects.toThrow();

      expect(list.getItems()).toHaveLength(2);
    });

    it('should update item optimistically', async () => {
      const asyncFn = vi.fn().mockResolvedValue({
        id: 1,
        name: 'Updated Item',
      });

      await list.update(1, { name: 'Updated Item' }, asyncFn);

      const items = list.getItems();
      expect(items[0].name).toBe('Updated Item');
    });

    it('should rollback update on failure', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(
        list.update(1, { name: 'Failed Update' }, asyncFn)
      ).rejects.toThrow();

      const items = list.getItems();
      expect(items[0].name).toBe('Item 1'); // Original value
    });

    it('should delete item optimistically', async () => {
      const asyncFn = vi.fn().mockResolvedValue(true);

      await list.delete(1, asyncFn);

      // After brief delay for animation
      await new Promise((resolve) => setTimeout(resolve, 400));

      const items = list.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(2);
    });

    it('should restore item on delete failure', async () => {
      const asyncFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(list.delete(1, asyncFn)).rejects.toThrow();

      // After brief delay
      await new Promise((resolve) => setTimeout(resolve, 400));

      const items = list.getItems();
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe(1);
    });

    it('should throw error if item not found', async () => {
      const asyncFn = vi.fn();

      await expect(
        list.update(999, { name: 'Test' }, asyncFn)
      ).rejects.toThrow('Item not found');
    });

    it('should unsubscribe listener', () => {
      const unsubscribe = list.subscribe(listener);
      unsubscribe();

      list.setItems([]);
      expect(listener).toHaveBeenCalledTimes(0);
    });
  });
});
