# Toast Notification System

## Usage

To use toast notifications in any page or component:

### 1. Import the hook and component

```tsx
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
```

### 2. Use the hook in your component

```tsx
export default function MyPage() {
  const { toasts, showToast, removeToast } = useToast()
  
  // Show a success toast
  const handleSuccess = () => {
    showToast('Operation successful!', 'success')
  }
  
  // Show an error toast
  const handleError = () => {
    showToast('Something went wrong!', 'error')
  }
  
  // Show a warning toast
  const handleWarning = () => {
    showToast('Please check your input!', 'warning')
  }
  
  return (
    <>
      {/* Your page content */}
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
      
      {/* Add the ToastContainer at the end */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  )
}
```

## Toast Types

- `'success'` - Green toast with checkmark icon
- `'error'` - Red toast with X icon  
- `'warning'` - Orange toast with warning icon

## Features

- Auto-dismiss after 5 seconds
- Manual dismiss with close button
- Smooth slide-in animation
- Responsive design
- Stackable toasts

