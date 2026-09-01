import { ownerHandleUrl } from './ownerHandle';

test('owner handle uses production frontend and normalized serial', () => {
  expect(ownerHandleUrl('SN001')).toBe('https://serpico.onrender.com/x-hard-data/hw/SN001');
});
