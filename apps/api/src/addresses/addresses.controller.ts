import { Body, Patch, Controller, Get, Req, UseGuards, Post, Delete, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, type AuthenticatedRequest } from '../auth/session-auth.guard';
import { AddressesService } from './addresses.service';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAddressDto } from './dto/create-address.dto';

@ApiTags('addresses')
@Controller('addresses')
export class AddressesController {
    constructor(private readonly addressesService: AddressesService) {}

    @Get()
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'List the current user addresses' })
    getAddresses(@Req() req: AuthenticatedRequest) {
        return this.addressesService.getAddresses(req.user.id);
    }

    @Post()
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Create a new address for the current user' })
    createAddress(@Req() req: AuthenticatedRequest, @Body() createAddressDto: CreateAddressDto) {
        return this.addressesService.createAddress(req.user.id, createAddressDto);
    }

    @Get('default')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Get the default address for the current user' })
    getDefaultAddress(@Req() req: AuthenticatedRequest) {
        return this.addressesService.getDefaultAddress(req.user.id);
    }

    @Patch(':id')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Update an address for the current user' })
    updateAddress(
        @Req() req: AuthenticatedRequest,
        @Param('id') id: string,
        @Body() updateAddressDto: UpdateAddressDto,
    ) {
        return this.addressesService.updateAddress(req.user.id, id, updateAddressDto);
    }

    @Delete(':id')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Soft-delete an address for the current user' })
    deleteAddress(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.addressesService.deleteAddress(req.user.id, id);
    }

    @Post(':id/restore')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Restore a soft-deleted address (undo delete)' })
    restoreAddress(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.addressesService.restoreAddress(req.user.id, id);
    }

    @Patch(':id/default')
    @UseGuards(SessionAuthGuard)
    @ApiOperation({ summary: 'Set the active delivery address' })
    setDefaultAddress(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.addressesService.setDefaultAddress(req.user.id, id);
    }
}