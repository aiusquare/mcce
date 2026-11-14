# ApplicationPage Update - User Profile & Progress Integration

## Overview

Updated `src/pages/student/ApplicationPage.tsx` to fetch and display user profile data and application progress from the backend API instead of using hardcoded mock data.

## Key Changes

### 1. **Added useEffect Hook for Data Fetching**

- On component mount, fetches:
  - User profile from `localStorage` (fallback) and/or `/api/student/profile`
  - Application progress from `/api/student/progress`
- Handles errors gracefully with `toast.error()`

### 2. **Dynamic Profile Loading**

- **Header Integration**: Profile and notification count now passed to `<StudentLayout>`
- **Name Pre-filling**: Extracted first/middle/last name from `profile.full_name` and populate form defaults
- **Email Pre-filling**: Contact form pre-filled with `profile.email` and `profile.phone`
- **Header Display**: Shows actual user name (e.g., "Welcome back, Aminu Ibrahim Mohammed") instead of generic "Welcome back, Student"
- **Application ID**: Displays correct `application_id` in header instead of "--"

### 3. **Dynamic Onboarding Status**

- Onboarding status (email verified, application fee paid, NIN verified) now comes from:
  - Backend `/api/student/progress` response (preferred)
  - Fallback to all `true` if progress data unavailable
- Status badgestatus is now accurate to user's actual progression stage

### 4. **Form Access Control**

- Form is disabled if any onboarding prerequisite is not met:
  ```typescript
  const canEditForm =
    onboardingStatus.emailVerified &&
    onboardingStatus.applicationFeePaid &&
    onboardingStatus.ninVerified;
  ```
- Submit button disabled until all prerequisites complete

### 5. **Component Structure**

- Added state management for:
  - `profile`: User profile object (Student name, email, application_id, phone, NIN)
  - `applicationProgress`: Progress tracking (current_step, steps array)
  - `uploadedFiles`: Document uploads tracking
  - `oLevelSubjects1/2`: O'Level examination subjects
  - `currentStep`: Multi-step form navigation
  - `hasSecondSitting`: O'Level sitting flag

### 6. **Imports Added**

- `useEffect` from React (for data fetching on mount)
- `api` from `@/lib/api` (for backend communication)
- `toast` from sonner (for error/success notifications)

## Technical Details

### API Calls Flow:

```
ApplicationPage Mount
  ├─ Check localStorage for "mcchst_profile"
  ├─ Call api.getApplicationProgress()
  │  └─ Returns: { status: "success", data: { current_step: 1, steps: [...] }}
  └─ Store profile & progress in state
```

### Data Structure Expected:

```typescript
// Profile from localStorage or /api/student/profile
{
  id: string,
  full_name: string,           // e.g., "Aminu Ibrahim Mohammed"
  email: string,               // e.g., "user@example.com"
  phone?: string,              // e.g., "+2348012345678"
  nin?: string,                // National Identification Number
  application_id: string       // e.g., "APP-2024-001"
}

// Progress from /api/student/progress
{
  current_step: number,        // 1-5
  steps: [
    { name: "Personal Info", completed: boolean },
    { name: "Contact Details", completed: boolean },
    { name: "Academic History", completed: boolean },
    { name: "Documents", completed: boolean },
    { name: "Review", completed: boolean }
  ]
}
```

## Testing Instructions

### Prerequisites:

1. User must be logged in (profile saved in localStorage via StudentLoginPage)
2. Backend endpoints must be accessible:
   - `GET /api/student/profile`
   - `GET /api/student/progress`

### Test Scenario 1: Verify Header Display

1. Navigate to `http://localhost:8081/student/apply`
2. **Expected**: Header should show:
   - User's full name (e.g., "Welcome back, Aminu Ibrahim Mohammed")
   - Correct `application_id` (e.g., "APP-2024-001")
   - Correct notification count
3. **Actual**: Should match from backend data, not hardcoded "Student" and "--"

### Test Scenario 2: Verify Form Pre-filling

1. On Personal Info step, verify:
   - **First Name**: Extracted from profile.full_name
   - **Middle Name**: Extracted from profile.full_name
   - **Last Name**: Extracted from profile.full_name
2. These fields should be **disabled** (read-only) as they come from NIN verification
3. On Contact Details step, verify:
   - **Email**: Pre-filled from profile.email
   - **Phone**: Pre-filled from profile.phone (if available)

### Test Scenario 3: Verify Onboarding Status

1. Check the onboarding status badges below the application form header
2. **Expected Color Indicators**:
   - ✅ Green "success" badge = prerequisite met
   - ❌ Red "destructive" badge = prerequisite pending
3. Three badges should display:
   - Email {verified/pending}
   - Application fee {paid/pending}
   - NIN {verified/pending}

### Test Scenario 4: Verify Form Disabled State

1. If any onboarding prerequisite is `false`, the form should be disabled
2. **Expected**: "Next" button should be disabled with cursor showing restriction
3. **Message**: Display "Prerequisites" card with instructions

### Test Scenario 5: Multi-User Test

1. Log out and log in with a different user account
2. Navigate to `/student/apply`
3. **Expected**: Form should show different user's data (not previous user's)
4. This verifies data isolation and correct localStorage handling

## Files Changed

### Modified

- `src/pages/student/ApplicationPage.tsx` - Main application form component
  - Added useEffect for data fetching
  - Dynamic profile and progress integration
  - Form pre-filling from backend data
  - studentLayout props updated

### Backed Up

- `src/pages/student/ApplicationPage.tsx.bak` - Original version (for reference)

## Known Limitations & Future Tasks

1. **Form Submission**: Currently logs to console only (no backend POST)
   - Todo: Implement `POST /api/student/application` to save form data
2. **Step Persistence**: currentStep is not persisted to backend
   - Todo: Save `current_step` to backend when user navigates steps
   - This allows users to resume from where they left off

3. **O'Level Subjects**: Currently just form structure, no dynamic rendering
   - Todo: Render O'Level subjects list dynamically based on component state

4. **Document Validation**: File upload validation is basic
   - Todo: Add file size, format, and MD5 validation

5. **Academic Form**: Requires more fields implementation
   - Todo: Add JAMB score, previous institution details, qualification selection logic

## Error Handling

The component gracefully handles:

- Missing profile data (falls back to empty form)
- API failures (shows toast error message)
- localStorage unavailability (allows continued function)
- Invalid/malformed API responses (error handling in try-catch)

## Performance Notes

- Profile data fetched from localStorage first (instant display)
- API call happens in background to get fresh data
- No unnecessary re-renders (useEffect has empty dependency array for mount-time fetch only)

## Backend Verification

Ensure backend endpoints return data in expected format:

```bash
# Test profile endpoint
curl http://localhost/mcchst-new-updated-backend/api/student/profile

# Expected response:
{
  "status": "success",
  "data": {
    "id": "uuid-12345",
    "full_name": "Aminu Ibrahim Mohammed",
    "email": "student@example.com",
    "phone": "+2348012345678",
    "application_id": "APP-2024-001"
  }
}

# Test progress endpoint
curl http://localhost/mcchst-new-updated-backend/api/student/progress

# Expected response:
{
  "status": "success",
  "data": {
    "current_step": 1,
    "steps": [
      { "name": "Personal Info", "completed": false },
      { "name": "Contact Details", "completed": false },
      { "name": "Academic History", "completed": false },
      { "name": "Documents", "completed": false },
      { "name": "Review", "completed": false }
    ]
  }
}
```

## Next Steps

1. ✅ ApplicationPage fetches profile and progress
2. ✅ Header displays correct user information
3. ✅ Forms pre-filled with user data
4. ✅ Onboarding status reflects backend state
5. 🔄 TODO: Implement form submission to backend
6. 🔄 TODO: Add step persistence to resume applications
7. 🔄 TODO: Full form validation and edge cases
