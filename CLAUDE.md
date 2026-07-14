# The Gentry Lab — Claude Code Instructions

This file holds standing instructions for Claude Code when working on this
repository. Module-specific specs are added below as sections.

## Project Module

Project Portfolio, Project Insight and Project Settings.

The Project module is the main control center of the construction management app.
It must help users:

- Find projects quickly
- Filter and organize projects
- See project health at a glance
- Open a project and view its main insight
- Navigate to all related modules
- Configure project settings
- Control users, companies, roles, branding and workflows

The Project module should have three main levels:

```text
Project Portfolio
→ Project Insight
→ Project Settings
```

### 1. Project Portfolio Screen

**Purpose**

The Project Portfolio screen shows all projects that the user is authorized to access.
It must support both:

- Card view
- List view

The selected view should be remembered for each user.

### 2. Project Portfolio Header

The top area should contain:

- Page title: Projects
- Search
- Filter
- Sort
- View selector
- Add Project button
- Portfolio summary

Example:

```text
Projects                             + New Project
[ Search projects... ]   Filter   Sort   Grid/List
```

### 3. Portfolio Summary

At the top, show clickable summary cards:

- All Projects
- Active
- Planning
- On Hold
- Completed
- Delayed
- At Risk
- Archived

Example:

```text
All        Active        Delayed        Completed
26         18            3              5
```

Clicking a card should apply the related filter.

Additional summary indicators may show:

- Total contract value
- Average progress
- Open critical issues
- Pending approvals
- Projects requiring attention

### 4. Project Search

Search should work across:

- Project name
- Project code
- Client
- Consultant
- Contractor
- Project manager
- Location
- Province
- Sector
- Company
- Contract number

Search results should update immediately.
Support recent searches and saved searches.

### 5. Project Filters

Use a filter drawer or filter bottom sheet on mobile.

**Main Filters**

- Project status
- Project health
- Project stage
- Client
- Consultant
- Main contractor
- Project manager
- Province
- Sector
- Start date
- Completion date
- Contract value range
- Progress range
- Company
- User involvement
- Favorite projects
- Archived projects

**Project Status**

- Draft
- Tender
- Planning
- Pre-Construction
- Active
- On Hold
- Delayed
- Defect Liability
- Handover
- Completed
- Closed
- Archived

**Project Health**

- Green
- Amber
- Red

**Project Sector**

- Industrial
- Warehouse
- Factory
- Commercial
- Residential
- Infrastructure
- Airport
- Stadium
- Logistics
- Healthcare
- Education
- Other

Allow users to:

- Apply filters
- Clear filters
- Save filter
- Set default filter

Show active filter chips above the project list.

### 6. Project Sorting

Allow sorting by:

- Recently viewed
- Recently updated
- Project name
- Project code
- Start date
- Completion date
- Progress
- Contract value
- Health status
- Number of overdue items
- Pending approvals

Default sorting should prioritize:

```text
Favorite Projects
→ Projects Requiring Attention
→ Recently Viewed
```

### 7. Project Card Design

Each project card should clearly show:

- Project logo or cover image
- Project name
- Project code
- Client logo
- Main contractor logo
- Project location
- Project manager
- Project status
- Health status
- Planned progress
- Actual progress
- Completion date
- Open issue count
- Pending approval count
- Favorite button
- More-action menu

Example:

```text
[Project Image]

ZINUS Factory Phase 1
ZIN-PH1-2025

Client: ZINUS
Location: ISI Park 2
Project Manager: Mr. A

Planned: 82%
Actual: 76%
Delay: -6%

Status: Active
Health: Amber

12 Open Issues | 4 Pending Approvals
```

Use simple progress bars:

```text
Planned Progress    82%
Actual Progress     76%
```

### 8. Project List View

The list view should support more projects on one screen.

Columns:

- Project
- Code
- Client
- Location
- Project Manager
- Status
- Health
- Planned progress
- Actual progress
- Completion date
- Open issues
- Pending approvals

On mobile, show the most important fields only.

### 9. Quick Actions from Project Card

The three-dot menu should allow:

- Open Project
- View Dashboard
- Open Site Diary
- Open Schedule
- Open Files
- Add to Favorites
- Share Project
- Edit Project
- Archive Project

Only show actions the user has permission to perform.

### 10. Project Creation Workflow

Use a guided step-by-step setup.

**Step 1: Basic Information**

- Project name
- Project code
- Project description
- Project type
- Sector
- Project status
- Contract number
- Currency
- Contract value

**Step 2: Location**

- Country
- Province
- City
- Address
- GPS coordinates
- Map location
- Site boundary, if available

**Step 3: Dates**

- Tender date
- Contract date
- Start date
- Planned completion date
- Defect liability start
- Defect liability end

**Step 4: Companies**

- Client
- Consultant
- Main contractor
- Designer
- Subcontractors
- Suppliers

**Step 5: Project Team**

- Project director
- Project manager
- Construction manager
- Site engineers
- QA/QC team
- Safety team
- Planning team
- QS team
- Client users
- Consultant users

**Step 6: Project Structure**

- Buildings
- Floors
- Zones
- Areas
- Disciplines
- Work packages

**Step 7: Workflows**

- Site Diary approval
- Inspection approval
- Submittal approval
- Punch closure
- Safety closure
- Report approval

**Step 8: Branding and Documents**

- Project logo
- Client logo
- Consultant logo
- Contractor logo
- PDF cover style
- Document numbering format

Show setup progress:

```text
Project Setup: 75% Complete
```

### 11. Project Insight Screen

When the user clicks a project, open the Project Insight screen.
This screen should provide a complete project summary before the user enters detailed modules.

The screen should have:

- Project header
- Project health summary
- Progress summary
- Action required
- Module shortcuts
- Recent activity
- Key people
- Project settings access

### 12. Project Header

Display:

- Project name
- Project code
- Project image
- Client logo
- Consultant logo
- Main contractor logo
- Location
- Project status
- Project health
- Start date
- Completion date
- Contract value
- Project manager
- Favorite button
- Share button
- Settings button

Example:

```text
ZINUS Factory Phase 1
ZIN-PH1-2025

ISI Park 2, Phnom Penh
Active | Health: Amber

Start: 11 March 2025
Completion: 20 November 2025
Project Manager: Mr. A
```

### 13. Project Insight Navigation

Use a consistent tab layout:

```text
Overview
Progress
Quality
Safety
Documents
Commercial
Team
Activity
Settings
```

On mobile, use horizontally scrollable tabs.

### 14. Overview Tab

The Overview tab should answer:

- Is the project progressing well?
- What requires attention?
- What is happening today?
- What is overdue?
- Who is responsible?

**Overview Cards**

Show:

- Overall progress
- Planned versus actual
- Schedule variance
- Cost status
- Open inspections
- Open punch items
- Safety observations
- Pending submittals
- Daily manpower
- Active equipment

**Attention Required**

Show a prioritized list:

```text
Critical Safety Issue — 1
Overdue Punch Items — 12
Rejected Inspections — 4
Late Submittals — 7
Schedule Activities Delayed — 8
Expiring Certificates — 3
```

Each item should be clickable.

### 15. Project Progress Tab

Show:

- Planned progress
- Actual progress
- Progress variance
- Baseline completion date
- Forecast completion date
- Delayed activities
- Look-ahead activities
- Progress by building
- Progress by discipline
- Progress by subcontractor
- BOQ progress

Charts should remain simple and readable.

Allow filtering by:

- Date
- Building
- Zone
- Discipline
- Company
- Work package

### 16. Quality Tab

Show:

- Total inspections
- Accepted
- Rejected
- Reinspection required
- Open punch items
- Closed punch items
- NCRs
- Test records
- Quality approval rate

Provide quick access to:

- Inspection
- Punch List
- NCR
- Test Reports
- Quality Files

### 17. Safety Tab

Show:

- Days without lost-time incident
- Open safety observations
- Critical risks
- Near misses
- Toolbox talks
- Safety inspections
- Permits
- Corrective-action status
- Expiring safety certificates

Provide quick access to the Safety module.

### 18. Documents Tab

Show both:

- System-generated records
- Manually uploaded controlled documents

**Summary:**

- Pending reviews
- Approved documents
- Revision required
- Superseded documents
- Latest drawings
- Latest reports
- Expiring documents
- Handover completeness

**Quick access:**

- Files
- Drawings
- Submittals
- Contracts
- Design
- Handover
- Document Register

### 19. Commercial Tab

Show:

- Contract value
- Approved variation
- Pending variation
- Certified amount
- Paid amount
- Remaining amount
- BOQ progress
- Cost status
- Claims
- Payment status

Restrict commercial information to authorized roles.

### 20. Team Tab

Show all project participants grouped by company and role.

**Groups:**

- Internal project team
- Client
- Consultant
- Main contractor
- Subcontractors
- Suppliers

Each person card should show:

- Photo
- Name
- Position
- Company
- Role
- Email
- Phone
- Project permission
- Active or inactive status

Allow authorized users to:

- Add user
- Invite user
- Edit project role
- Change permissions
- Deactivate user
- Remove user from project

Do not delete the user from the overall company directory when removing them from one project.

### 21. Activity Tab

Display a chronological project activity feed.

Examples:

- Site Diary approved
- Inspection submitted
- Punch item closed
- Drawing revised
- New company added
- User invited
- Schedule updated
- Report approved
- Project setting changed

Allow filtering by:

- Module
- User
- Company
- Date
- Action type

### 22. Module Shortcut Grid

Inside each project, show project-specific module shortcuts:

- Dashboard
- Site Diary
- Reports
- Photos
- Inspection
- Punch List
- Safety
- Submittal
- Schedule
- BOQ
- Manpower
- Equipment
- Files
- Directory

Once a user enters a project, all modules should automatically use that project as the active context.
The user should not need to select the project again inside every module.

### 23. Persistent Project Context

After opening a project, show a small project selector in the app header.

Example:

```text
Current Project: ZINUS Factory Phase 1
```

Allow users to switch projects without returning to the main portfolio.

When switching projects:

- Refresh module data
- Update permissions
- Update project branding
- Update locations
- Update companies
- Update workflows
- Keep the same module where possible

Example:

```text
Inspection — ZINUS Factory
→ Switch to CAW Warehouse
→ Inspection — CAW Warehouse
```

### 24. Project Settings Structure

The Project Settings area should use a clear left menu on desktop and section list on mobile.

Main setting categories:

```text
1. General
2. Branding
3. Companies
4. People and Roles
5. Permissions
6. Locations
7. Disciplines
8. Work Packages
9. Document Control
10. Workflows
11. Forms and Templates
12. Notifications
13. Integrations
14. Data and Archive
```

### 25. General Settings

Include:

- Project name
- Project code
- Description
- Sector
- Status
- Health status
- Contract information
- Project dates
- Currency
- Time zone
- Language
- Address
- GPS location
- Project image

Changing the project code should require administrator permission because it affects document numbering.

### 26. Branding Settings

Project branding controls all project screens and generated documents.

Allow users to configure:

- Project logo
- Client logo
- Consultant logo
- Main contractor logo
- Designer logo
- Header logo order
- Primary color
- Secondary color
- PDF cover style
- Report footer
- Company address
- Legal information
- Project stamp
- Signature block

Provide a live PDF cover preview.

Example display order:

```text
Client Logo | Project Logo | Consultant Logo | Contractor Logo
```

Allow the administrator to show or hide each logo.

### 27. Company Management

Create a centralized company database.
A company can participate in multiple projects.

**Company Fields**

- Company name
- Short name
- Company code
- Company type
- Registration number
- Tax number
- Address
- Country
- Phone
- Email
- Website
- Primary contact
- Company logo
- Company stamp
- Status
- Notes

**Company Types**

- Client
- Developer
- Consultant
- Architect
- Designer
- Main Contractor
- Subcontractor
- Supplier
- Manufacturer
- Testing Agency
- Authority
- Other

**Project Company Assignment**

When assigning a company to a project, store:

- Project role
- Contract package
- Work package
- Discipline
- Start date
- End date
- Primary representative
- Approval authority
- Active status

Do not create duplicate company records for every project.
Use one company master record and assign it to multiple projects.

### 28. Company Logo Management

Allow authorized users to upload and maintain:

- Main company logo
- Secondary logo
- Company stamp
- Letterhead
- Signature image, where legally acceptable

Logo requirements:

- PNG, JPG or SVG
- Transparent background preferred
- File-size validation
- Image dimension validation
- Preview before saving
- Version history

When a company logo changes:

- Use the new logo for future documents
- Preserve the old logo inside already generated PDFs
- Do not regenerate historical documents automatically

### 29. People Management

Use one centralized user directory across all projects.

**User Profile Fields**

- Full name
- Profile photo
- Email
- Phone
- Job title
- Company
- Department
- Default role
- Signature
- Active status
- Preferred language
- Notification preference

**Project Assignment Fields**

- Project
- Project role
- Company
- Discipline
- Permission group
- Start date
- End date
- Approval authority
- Can sign documents
- Active or inactive

A person may have different roles in different projects.

Example:

```text
Person: John Smith

Project A: Project Manager
Project B: Consultant Reviewer
Project C: Viewer
```

### 30. Role and Permission Control

Permissions should be configured by:

- Module
- Action
- Project
- Company
- User role

Actions:

- View
- Create
- Edit
- Submit
- Review
- Approve
- Reject
- Close
- Reopen
- Export
- Download
- Upload
- Manage users
- Manage settings

Example:

```text
Subcontractor
- View own records
- Create Site Diary activity
- Submit inspection
- Respond to punch item
- Cannot approve inspection
- Cannot view confidential contracts
```

Support both:

- Standard role templates
- Custom project roles

### 31. Location Settings

Create and manage the project location hierarchy.

```text
Project
→ Site
→ Building
→ Floor
→ Zone
→ Area
→ Room or Gridline
```

Allow:

- Add
- Edit
- Reorder
- Archive
- Import from Excel
- Copy from another project

Every location should have:

- Location code
- Location name
- Parent location
- Description
- Status
- Optional drawing reference
- Optional map coordinate

### 32. Discipline Settings

Allow the project administrator to enable only relevant disciplines.

Example:

- Architecture
- Structural
- Civil
- Steel
- Mechanical
- Electrical
- Plumbing
- Fire Protection
- Infrastructure
- Roofing
- Cladding
- Landscape
- Safety
- Quality

Each discipline may have:

- Code
- Name
- Discipline lead
- Default reviewer
- Document prefix
- Color indicator

### 33. Work Package Settings

Define work packages such as:

- Earthworks
- Foundation
- Structural Steel
- Roofing
- Cladding
- MEP
- Fire Protection
- External Works
- Testing and Commissioning

Each work package may connect to:

- Company
- Discipline
- BOQ items
- Schedule activities
- Inspections
- Submittals
- Locations

### 34. Document Control Settings

Allow configuration of:

- Project document numbering
- Module codes
- Revision format
- Approval codes
- PDF cover
- Footer
- QR verification
- Folder structure
- Automatic PDF generation rules
- Required metadata
- Archive rules

Example numbering configuration:

```text
[Project]-[Discipline]-[Document Type]-[Sequence]-[Revision]
```

### 35. Workflow Settings

Allow administrators to configure workflows by module.

Example Site Diary workflow:

```text
Prepared by Site Engineer
→ Reviewed by Construction Manager
→ Approved by Project Manager
```

Example Inspection workflow:

```text
Submitted by Contractor
→ Checked by QA/QC
→ Inspected by Consultant
→ Accepted or Rejected
```

Workflow settings should support:

- User or role approver
- Company-based approver
- Sequential approval
- Parallel approval
- Required comments
- Required signature
- Escalation after due date
- Delegation

### 36. Forms and Template Settings

Allow project administrators to configure:

- Required fields
- Optional fields
- Hidden fields
- Custom fields
- Checklists
- Report templates
- Inspection templates
- Safety templates
- Site Diary sections
- PDF templates

Do not allow basic system fields such as Project ID, Record ID or audit fields to be removed.

### 37. Notification Settings

Configure notification rules for:

- New assignment
- Approval required
- Rejection
- Overdue action
- Critical safety issue
- Late submittal
- Inspection reminder
- Certificate expiry
- Daily report missing

Configure recipients by:

- Role
- Company
- Named user
- Module
- Severity

### 38. Project Archive and Closeout

When a project is completed:

```text
Active
→ Handover
→ Defect Liability
→ Closed
→ Archived
```

Before closing, check:

- Open punch items
- Pending inspections
- Pending submittals
- Missing handover documents
- Unapproved reports
- Active users
- Outstanding actions

Display a closeout checklist.

Archived projects should:

- Become read-only by default
- Remain searchable
- Preserve files and audit history
- Be restorable by administrators

### 39. Recommended Project Module UI Flow

```text
Projects
→ Search or Filter
→ Select Project
→ Project Insight
→ Review Attention Items
→ Open Required Module
```

For administration:

```text
Projects
→ Select Project
→ Settings
→ Select Setting Category
→ Update Companies, People, Locations or Workflows
```

For quick daily use:

```text
Projects
→ Favorite Project
→ Site Diary
→ Create Today's Record
```

### 40. Development Rules for Claude Code

1. Separate portfolio data from project configuration data.
2. Use one central company master.
3. Use one central people directory.
4. Assign companies and people to projects instead of duplicating them.
5. Use reusable project cards and summary widgets.
6. Keep project context active across modules.
7. Use role-based visibility for commercial and confidential information.
8. Save user filter and view preferences.
9. Support favorite and recently viewed projects.
10. Keep project settings modular and easy to navigate.
11. Record every project-setting change in the audit log.
12. Require confirmation for critical changes.
13. Preserve historical company logos in old PDF records.
14. Do not allow unauthorized users to edit project configuration.
15. Make the project insight page useful within five seconds of opening it.

**Core Project Principle**

Users should quickly find the correct project, understand its condition immediately,
enter the required module with one click, and manage all project companies, people,
branding, locations, permissions, documents and workflows from one controlled
settings area.
