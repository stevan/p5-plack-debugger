package Plack::Debugger::Panel::ModuleVersions;

# ABSTRACT: Debug panel for inspecting Perl module versions

use strict;
use warnings;

use Module::Versions;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Module Versions';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        my $modules = Module::Versions->HASH;
        $self->set_result([
            map { 
                $_ => $modules->{ $_ }->{'VERSION'} 
            } sort keys %$modules
        ]);
    };

    $class->SUPER::new( \%args );
}

1;

__END__

=pod

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that will display the 
versions of all the modules found in C<%INC>. 

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the author would like to express their gratitude.

=cut